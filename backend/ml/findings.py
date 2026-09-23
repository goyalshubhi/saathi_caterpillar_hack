"""Rule-based behaviour findings over TelemetryWindows (BehaviorFinding contract)."""
from datetime import datetime
from statistics import median

IDLE_SHARE_THRESHOLD = 0.6          # idle >= 9 of 15 min
FUEL_PER_CYCLE_FACTOR = 3.0         # x the machine's median fuel per load cycle
FUEL_NO_WORK_MIN_L = 1.0            # litres burned in a window with zero load cycles
DEFAULT_FUEL_PER_CYCLE = 0.45       # reference when too few windows to take a median
ALERT_WINDOW_MIN = 60
WINDOW_MIN = 15
TS_FORMAT = "%Y-%m-%d %H:%M:%S"


def _ts(w):
    return datetime.strptime(w["timestamp"], TS_FORMAT)


def _finding(type_, severity, window, **slots):
    return {"type": type_, "severity": severity, "window_timestamp": window["timestamp"],
            "message_key": f"finding.{type_}", "slots": slots}


def _runs(windows, predicate):
    """Consecutive runs of windows matching predicate -> list of lists."""
    runs, current = [], []
    for w in windows:
        if predicate(w):
            current.append(w)
        elif current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)
    return runs


def excessive_idling(windows):
    out = []
    for run in _runs(windows, lambda w: w["idling_time_min"] / WINDOW_MIN >= IDLE_SHARE_THRESHOLD):
        minutes = sum(w["idling_time_min"] for w in run)
        out.append(_finding("excessive_idling", "medium" if minutes >= 20 else "low", run[0], minutes=minutes))
    return out


def fuel_without_work(windows):
    per_cycle = [w["fuel_used_l"] / w["load_cycles"] for w in windows if w["load_cycles"] > 0]
    reference = median(per_cycle) if len(per_cycle) >= 4 else DEFAULT_FUEL_PER_CYCLE
    out = []
    for w in windows:
        fuel, cycles = w["fuel_used_l"], w["load_cycles"]
        no_work = cycles == 0 and w["machine_active"] and fuel >= FUEL_NO_WORK_MIN_L
        wasteful = cycles > 0 and fuel / cycles > FUEL_PER_CYCLE_FACTOR * reference
        if no_work or wasteful:
            out.append(_finding("fuel_without_work", "medium", w, fuel_l=fuel, load_cycles=cycles))
    return out


def unbelted_active(windows):
    out = []
    for run in _runs(windows, lambda w: w["machine_active"] and w["seatbelt_status"] == "Unfastened"):
        out.append(_finding("unbelted_active", "high", run[0], minutes=WINDOW_MIN * len(run)))
    return out


def repeated_alerts(windows):
    """Fires on the window with the 2nd (or later) alert within 60 min of the previous one."""
    out, previous = [], None
    for w in windows:
        if w["safety_alert_triggered"] != "Yes":
            continue
        if previous is not None and (_ts(w) - _ts(previous)).total_seconds() <= ALERT_WINDOW_MIN * 60:
            out.append(_finding("repeated_alerts", "high", w, count=2,
                                minutes=int((_ts(w) - _ts(previous)).total_seconds() // 60)))
        previous = w
    return out


RULES = [excessive_idling, fuel_without_work, unbelted_active, repeated_alerts]


def group_windows(windows):
    """Windows split per (machine, operator), each sorted by time."""
    groups = {}
    for w in windows:
        groups.setdefault((w["machine_id"], w["operator_id"]), []).append(w)
    return [sorted(g, key=lambda w: w["timestamp"]) for g in groups.values()]


def rule_findings(windows):
    out = []
    for group in group_windows(windows):
        for rule in RULES:
            out.extend(rule(group))
    return sorted(out, key=lambda f: f["window_timestamp"])
