"""Loaders for the two tables given in the brief (data/given/*.csv)."""
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
GIVEN_DIR = REPO_ROOT / "data" / "given"

USAGE_COLUMNS = [
    "timestamp", "machine_id", "operator_id", "engine_hours", "fuel_used_l",
    "load_cycles", "idling_time_min", "seatbelt_status", "safety_alert_triggered",
]
TASK_COLUMNS = [
    "task_id", "task_type", "weather", "operator_skill", "machine_age_yrs",
    "estimated_time_min", "actual_time_min",
]

USAGE_TYPES = {"engine_hours": float, "fuel_used_l": float, "load_cycles": int, "idling_time_min": int}
TASK_TYPES = {"machine_age_yrs": int, "estimated_time_min": int, "actual_time_min": int}

ALLOWED = {
    "seatbelt_status": {"Fastened", "Unfastened"},
    "safety_alert_triggered": {"Yes", "No"},
    "weather": {"Sunny", "Cloudy", "Rainy", "Windy"},
    "operator_skill": {"Beginner", "Intermediate", "Expert"},
}


class SchemaError(ValueError):
    """Raised when a given CSV does not match the brief's schema."""


def _load(path, columns, types):
    path = Path(path)
    if not path.exists():
        raise SchemaError(f"{path.name}: file not found at {path}")
    df = pd.read_csv(path, dtype=str)
    if list(df.columns) != columns:
        raise SchemaError(f"{path.name}: expected columns {columns}, got {list(df.columns)}")
    if df.isna().any().any():
        raise SchemaError(f"{path.name}: empty cells are not allowed")
    for col, typ in types.items():
        try:
            df[col] = df[col].astype(float).astype(typ)
        except ValueError as exc:
            raise SchemaError(f"{path.name}: column {col} must be {typ.__name__}: {exc}") from exc
    for col, allowed in ALLOWED.items():
        if col in df.columns:
            bad = set(df[col]) - allowed
            if bad:
                raise SchemaError(f"{path.name}: column {col} has unexpected values {sorted(bad)}")
    if "timestamp" in df.columns:
        try:
            pd.to_datetime(df["timestamp"], format="%Y-%m-%d %H:%M:%S")
        except ValueError as exc:
            raise SchemaError(f"{path.name}: bad timestamp: {exc}") from exc
    return df.to_dict(orient="records")


def load_given_tasks(path=GIVEN_DIR / "tasks.csv"):
    return _load(path, TASK_COLUMNS, TASK_TYPES)


def load_given_usage(path=GIVEN_DIR / "machine_usage.csv"):
    return _load(path, USAGE_COLUMNS, USAGE_TYPES)
