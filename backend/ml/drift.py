"""Fatigue drift (P1): IsolationForest on per-window behaviour, checked over the last hour of a shift.

A sustained anomaly only counts as fatigue if it also looks like fatigue rather than harder work:
completed load cycles dropped versus earlier in the shift, or safety lapses (unbelted / alerts).
Harder terrain makes cycles slower and costlier but still completes them, so it is not flagged.
Falls back to a simple rule when no trained model is available.
"""
import statistics
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
THROUGHPUT_DROP = 0.8       # fatigue-like: last-hour median cycles <= 80% of the shift's earlier median
GATE_MIN_LAPSES = 2         # ...or at least this many unbelted/alert windows in the last hour
SHIFT_GAP = timedelta(minutes=WINDOW_MIN)

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


def _current_shift(group):
    """Windows after the last gap longer than one window (one operator's windows can span days)."""
    start = 0
    for i in range(1, len(group)):
        gap = datetime.strptime(group[i]["timestamp"], TS_FORMAT) - datetime.strptime(group[i - 1]["timestamp"], TS_FORMAT)
        if gap > SHIFT_GAP:
            start = i
    return group[start:]


def _lapses(windows):
    return [w for w in windows if w["seatbelt_status"] == "Unfastened" or w["safety_alert_triggered"] == "Yes"]


def throughput_ratio(earlier, last):
    """Median load cycles in the last hour / median over the earlier working windows (None if unknown)."""
    base = statistics.median(w["load_cycles"] for w in earlier) if earlier else 0
    return statistics.median(w["load_cycles"] for w in last) / base if base else None


def looks_like_fatigue(earlier, last):
    """Throughput fell, or safety lapses: things harder terrain alone does not explain."""
    ratio = throughput_ratio(earlier, last)
    return (ratio is not None and ratio <= THROUGHPUT_DROP) or len(_lapses(last)) >= GATE_MIN_LAPSES


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
    lapses = _lapses(last)
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
        if model is not None:
            shift = _current_shift(group)
            flagged = _model_flags(model, last)
            if flagged and not looks_like_fatigue([w for w in earlier if w in shift], last):
                flagged = []            # anomalous but throughput kept and no lapses: harder work, not fatigue
        else:
            flagged = _rule_flags(earlier, last)
        if flagged:
            out.append({"type": "fatigue_drift", "severity": "medium", "window_timestamp": flagged[0]["timestamp"],
                        "message_key": "finding.fatigue_drift", "slots": {"windows": len(flagged)}})
    return out
