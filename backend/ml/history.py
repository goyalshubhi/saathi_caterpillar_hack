"""How much past telemetry exists for an operator (cold start).

A new operator has no tracked shifts, so no line may claim a personal comparison ("your rhythm").
History stays on the device: this only counts the operator's past shifts in the local telemetry.
"""
from datetime import datetime, timedelta

import pandas as pd

from backend.data_gen.generator import SYNTHETIC_DIR, generate_all

from .findings import TS_FORMAT, WINDOW_MIN

SHIFT_GAP = timedelta(minutes=WINDOW_MIN)   # a longer gap between windows starts a new shift

_counts = None


def _shift_counts():
    """operator_id -> number of shifts: runs of consecutive 15-min windows on one machine."""
    global _counts
    if _counts is None:
        path = SYNTHETIC_DIR / "telemetry.csv"
        if not path.exists():
            generate_all()
        df = pd.read_csv(path, usecols=["timestamp", "machine_id", "operator_id"])
        _counts = {}
        for (op, _machine), g in df.groupby(["operator_id", "machine_id"]):
            ts = sorted(datetime.strptime(t, TS_FORMAT) for t in g.timestamp)
            _counts[op] = _counts.get(op, 0) + 1 + sum(1 for a, b in zip(ts, ts[1:]) if b - a > SHIFT_GAP)
    return _counts


def operator_history(operator_id: str) -> dict:
    shifts = _shift_counts().get(operator_id, 0)
    return {"operator_id": operator_id, "shift_count": shifts, "history_available": shifts > 0}
