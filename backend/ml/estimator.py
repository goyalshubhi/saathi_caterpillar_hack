"""Task time estimator (GradientBoostingRegressor) + counterfactual "not your fault" split."""
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder

from backend.data_gen import load_given_tasks
from backend.data_gen.generator import SYNTHETIC_DIR, generate_all

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "time_estimator.joblib"

CATEGORICAL = ["task_type", "weather"]
ORDINAL = ["operator_skill"]
NUMERIC = ["temperature_c", "machine_age_yrs", "estimated_time_min", "scheduled_hour"]
FEATURES = CATEGORICAL + ORDINAL + NUMERIC

# "Ideal" conditions for the counterfactual; skill and time of day stay as they are.
IDEAL = {"weather": "Sunny", "temperature_c": 25, "machine_age_yrs": 2}
FACTORS = {"weather": ["weather"], "temperature": ["temperature_c"], "machine_age": ["machine_age_yrs"]}

# Defaults for tasks that lack a field (e.g. rows of the given table).
DEFAULT_TEMP = {"Sunny": 30, "Cloudy": 27, "Rainy": 24, "Windy": 26}
DEFAULT_HOUR = 9
MIN_FACTOR_MIN = 0.5

# Idle minutes per 15-min window that count as normal (given table: ~15-30 min idle per 2 h of work).
NORMAL_IDLE_PER_WINDOW = 4
WINDOW_MIN = 15

_model = None


def _training_frame():
    path = SYNTHETIC_DIR / "tasks.csv"
    if not path.exists():
        generate_all()
    df = pd.read_csv(path)
    given = pd.DataFrame(load_given_tasks())
    given["temperature_c"] = given.weather.map(DEFAULT_TEMP)
    given["scheduled_hour"] = DEFAULT_HOUR
    return pd.concat([df, given], ignore_index=True)


def build_model():
    pre = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
        ("skill", OrdinalEncoder(categories=[["Beginner", "Intermediate", "Expert"]]), ORDINAL),
    ], remainder="passthrough")
    gbr = GradientBoostingRegressor(n_estimators=300, max_depth=4, learning_rate=0.05, random_state=0)
    return Pipeline([("pre", pre), ("gbr", gbr)])


def train_estimator():
    """Fit on synthetic + given tasks. Target = actual / estimate (predicted min = estimate x ratio)."""
    df = _training_frame()
    model = build_model()
    model.fit(df[FEATURES], df.actual_time_min / df.estimated_time_min)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    global _model
    _model = model
    return model


def _get_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH) if MODEL_PATH.exists() else train_estimator()
    return _model


def _features(task):
    row = {k: task.get(k) for k in FEATURES}
    if row["temperature_c"] is None:
        row["temperature_c"] = DEFAULT_TEMP.get(task.get("weather"), 25)
    if row["scheduled_hour"] is None:
        row["scheduled_hour"] = DEFAULT_HOUR
    return row


def _predict_rows(rows):
    df = pd.DataFrame(rows)[FEATURES]
    return list(_get_model().predict(df) * df.estimated_time_min)


def _split_factors(deltas, total):
    """Rounded per-factor minutes that add up exactly to `total` (both rounded to 0.1)."""
    raw_sum = sum(deltas.values())
    if raw_sum * total > 0 and abs(raw_sum) >= 0.1:  # same sign: scale so the parts sum to total
        scaled = {k: v * total / raw_sum for k, v in deltas.items()}
    else:  # conditions pull in opposite directions: keep raw, remainder goes to "other"
        scaled = dict(deltas, other=total - raw_sum)
    factors = [{"name": k, "minutes": round(v, 1)} for k, v in scaled.items()]
    factors.sort(key=lambda f: -abs(f["minutes"]))
    # Tiny factors (< 0.5 min) are noise to an operator: drop them; rounding and the dropped
    # remainder go to the largest factor so the parts still add up exactly.
    kept = [factors[0]] + [f for f in factors[1:] if abs(f["minutes"]) >= MIN_FACTOR_MIN]
    kept[0]["minutes"] = round(kept[0]["minutes"] + total - sum(f["minutes"] for f in kept), 1)
    return kept


def predict(task: dict) -> dict:
    """Prediction contract. uncontrollable = predicted - prediction under ideal conditions."""
    base = _features(task)
    ideal = dict(base, **IDEAL)
    one_off = {name: dict(base, **{c: IDEAL[c] for c in cols}) for name, cols in FACTORS.items()}
    preds = _predict_rows([base, ideal, *one_off.values()])
    predicted, ideal_min = round(preds[0], 1), round(preds[1], 1)
    uncontrollable = round(predicted - ideal_min, 1)
    deltas = {name: preds[0] - p for name, p in zip(one_off, preds[2:])}
    return {
        "task_id": task.get("task_id"),
        "cat_estimate_min": task["estimated_time_min"],
        "predicted_min": predicted,
        "uncontrollable_min": uncontrollable,
        "controllable_min": 0.0,
        "top_factors": _split_factors(deltas, uncontrollable) if uncontrollable else [],
    }


def idle_gap_minutes(windows, task_minutes):
    """Idle minutes above normal, apportioned to the task by its share of the observed time."""
    if not windows:
        return 0.0
    excess = sum(max(0, w["idling_time_min"] - NORMAL_IDLE_PER_WINDOW) for w in windows)
    share = min(1.0, task_minutes / (WINDOW_MIN * len(windows)))
    return round(excess * share, 1)


def debrief(task: dict, windows: list[dict]) -> dict:
    """Prediction with the overrun split: uncontrollable (conditions) + controllable (idle gaps)."""
    result = predict(task)
    if result["uncontrollable_min"] < 0:  # conditions were better than ideal: nothing to excuse
        result["uncontrollable_min"], result["top_factors"] = 0.0, []
    result["controllable_min"] = idle_gap_minutes(windows, result["predicted_min"])
    return result


# Below this total overrun, the debrief states the number only: no attribution, no "not your
# fault". Explaining a 1-2 minute overrun claims more confidence than the model has (its own
# error on a task is a few minutes) and sounds hollow to an operator who knows it was trivial.
MIN_ATTRIBUTION_OVERRUN_MIN = 3


def debrief_lines(prediction: dict, history_available: bool = True) -> list[dict]:
    """Which debrief lines to speak for a debrief() result: [{message_key, slots}] in order.
    On an operator's first tracked shift (history_available False) the overrun line is the
    neutral variant, anchored to the CAT estimate only."""
    unc, ctl = prediction["uncontrollable_min"], prediction["controllable_min"]
    over = unc + ctl
    if round(over) <= 0:
        return [{"message_key": "debrief_on_time", "slots": {}}]
    if over < MIN_ATTRIBUTION_OVERRUN_MIN:
        return [{"message_key": "debrief_near_time", "slots": {"over_min": int(round(over))}}]
    factors = [f["name"] for f in sorted(prediction["top_factors"], key=lambda f: -f["minutes"]) if f["minutes"] > 0][:2]
    key = "debrief_over" if history_available else "debrief_over_first_shift"
    lines = [{"message_key": key, "slots": {
        "over_min": int(round(over)), "uncontrollable_min": int(round(unc)),
        "controllable_min": int(round(ctl)), "factors": factors}}]
    if unc >= ctl:
        lines.append({"message_key": "debrief_not_your_fault", "slots": {}})
    return lines


# Finding lines that imply knowing the operator's own habits -> neutral first-shift variant.
FIRST_SHIFT_VARIANTS = {"finding.fatigue_drift": "finding.fatigue_drift_first_shift"}


def finding_lines(findings: list[dict], history_available: bool = True) -> list[dict]:
    """[{message_key, slots}] to speak for BehaviorFindings; neutral wording on a first shift."""
    return [{"message_key": f["message_key"] if history_available
             else FIRST_SHIFT_VARIANTS.get(f["message_key"], f["message_key"]), "slots": f["slots"]}
            for f in findings]
