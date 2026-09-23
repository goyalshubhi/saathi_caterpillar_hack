"""Fatigue drift (P1): IsolationForest on per-window behaviour, checked over the last hour of a shift.

Falls back to a simple rule when no trained model is available.
"""
from datetime import datetime, timedelta
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest

from backend.data_gen.generator import SYNTHETIC_DIR, generate_all

from .findings import TS_FORMAT, WINDOW_MIN, group_windows

MODEL_PATH = Path(__file__).resolve().parent / "models" / "drift_iforest.joblib"
FEATURES = ["idle_share", "fuel_per_cycle", "unbelted", "alert"]
LAST_HOUR = timedelta(minutes=60)
MIN_FLAGGED = 2             # anomalous working windows needed in the last hour
MIN_HISTORY = 8             # need at least 2 h of windows before judging drift
RULE_IDLE_RISE = 0.1        # fallback: last-hour idle share this much above the earlier average
RULE_MIN_LAPSES = 2         # fallback: unbelted-while-active or alert windows in the last hour

_model = None


def window_features(windows):
    return pd.DataFrame([{
        "idle_share": w["idling_time_min"] / WINDOW_MIN,
        "fuel_per_cycle": w["fuel_used_l"] / max(1, w["load_cycles"]),
        "unbelted": int(w["seatbelt_status"] == "Unfastened"),
        "alert": int(w["safety_alert_triggered"] == "Yes"),
    } for w in windows], columns=FEATURES)


def train_drift():
    """Fit on the pooled working (machine_active) windows of the synthetic telemetry."""
    path = SYNTHETIC_DIR / "telemetry.csv"
    if not path.exists():
        generate_all()
    df = pd.read_csv(path)
    active = df[df.machine_active].to_dict(orient="records")
    model = IsolationForest(n_estimators=200, contamination=0.05, random_state=0)
    model.fit(window_features(active))
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    global _model
    _model = model
    return model


def _get_model():
    global _model
    if _model is None and MODEL_PATH.exists():
        _model = joblib.load(MODEL_PATH)
    return _model


def _split_last_hour(group):
    """Working windows of one operator: (earlier, last hour)."""
    active = [w for w in group if w["machine_active"]]
    if len(group) < MIN_HISTORY or not active:
        return [], []
    cutoff = datetime.strptime(group[-1]["timestamp"], TS_FORMAT) - LAST_HOUR
    last = [w for w in active if datetime.strptime(w["timestamp"], TS_FORMAT) > cutoff]
    return [w for w in active if w not in last], last


def _model_flags(model, last):
    """Last-hour windows the forest scores below its threshold (decision_function < 0).
    Drift = sustained: at least MIN_FLAGGED of them, including the latest MIN_FLAGGED in a row,
    so a single one-off alert or fuel spike mid-shift does not count."""
    if len(last) < MIN_FLAGGED:
        return []
    scores = model.decision_function(window_features(last))
    flagged = [w for w, s in zip(last, scores) if s < 0]
    return flagged if all(s < 0 for s in scores[-MIN_FLAGGED:]) else []


def _rule_flags(earlier, last):
    lapses = [w for w in last if w["seatbelt_status"] == "Unfastened" or w["safety_alert_triggered"] == "Yes"]
    if not earlier or len(lapses) < RULE_MIN_LAPSES:
        return []
    idle = lambda ws: sum(w["idling_time_min"] for w in ws) / (WINDOW_MIN * len(ws))
    return lapses if idle(last) >= idle(earlier) + RULE_IDLE_RISE else []


def fatigue_drift(windows, use_model=True):
    model = _get_model() if use_model else None
    out = []
    for group in group_windows(windows):
        earlier, last = _split_last_hour(group)
        if not last:
            continue
        flagged = _model_flags(model, last) if model is not None else _rule_flags(earlier, last)
        if flagged:
            out.append({"type": "fatigue_drift", "severity": "medium", "window_timestamp": flagged[0]["timestamp"],
                        "message_key": "finding.fatigue_drift", "slots": {"windows": len(flagged)}})
    return out
