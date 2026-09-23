"""Day planner: task order, breaks and condition-aware safety warnings (DayPlan contract)."""
import math

HOT_C = 35                  # above this: hydration warning and earlier breaks
WINDY_KMH = 30              # hourly wind at/above this counts as windy
BREAK_EVERY_H = 2
HOT_BREAK_EVERY_H = 1
TRENCH_EDGE_M = 2           # keep tracks this far from a trench edge in the wet
WIND_CAUTION_TASKS = {"Demolition", "Material Loading"}   # demolition + lifting/loading
PRECISION_TASKS = {"Trenching", "Grading"}                 # need a steady hand: cooler hours


def _weather_by_hour(weather):
    return {w["hour"]: w for w in weather or []}


def _conditions(task, hour, by_hour):
    """Effective conditions for a task at the hour it is planned: task fields + hourly forecast."""
    w = by_hour.get(hour, {})
    temp = w.get("temperature_c", task.get("temperature_c"))
    rainy = task.get("weather") == "Rainy" or bool(w.get("rain"))
    windy = task.get("weather") == "Windy" or w.get("wind_kmh", 0) >= WINDY_KMH
    return temp, rainy, windy


def order_tasks(tasks, weather):
    """Heat-aware order: precision tasks take the coolest of the day's scheduled slots,
    heavier-tolerance tasks the rest. Without a forecast, or when no slot is hot, keep the
    scheduled order (P0 fallback)."""
    scheduled = sorted(tasks, key=lambda t: t["scheduled_hour"])
    by_hour = _weather_by_hour(weather)
    slots = [t["scheduled_hour"] for t in scheduled]
    if not all(h in by_hour for h in slots) or all(by_hour[h]["temperature_c"] <= HOT_C for h in slots):
        return scheduled
    coolest = sorted(range(len(slots)), key=lambda i: (by_hour[slots[i]]["temperature_c"], i))
    precision = [t for t in scheduled if t["task_type"] in PRECISION_TASKS]
    others = [t for t in scheduled if t["task_type"] not in PRECISION_TASKS]
    assigned = {}
    for task, idx in zip(precision + others, coolest):
        assigned[idx] = task
    return [assigned[i] for i in range(len(slots))]


def timeline(ordered, slots):
    """(task, start_hour, end_hour_exclusive) with each task taking whole hours, no overlaps."""
    out, free_from = [], 0
    for task, slot in zip(ordered, slots):
        start = max(slot, free_from)
        end = start + max(1, math.ceil(task["estimated_time_min"] / 60))
        out.append((task, start, end))
        free_from = end
    return out


def plan_breaks(schedule, by_hour):
    """A break every ~2 h (every hour when it is hot), only in hours with no task."""
    if not schedule:
        return []
    busy = {h for _, start, end in schedule for h in range(start, end)}
    first, last = schedule[0][1], schedule[-1][2]
    breaks, since = [], 0
    for hour in range(first, last):
        temp = by_hour.get(hour, {}).get("temperature_c")
        hot = temp is not None and temp > HOT_C
        if hour not in busy and since >= (HOT_BREAK_EVERY_H if hot else BREAK_EVERY_H):
            breaks.append({"hour": hour, "reason": "heat" if hot else "regular"})
            since = 0
        else:
            since += 1
    return breaks


def condition_warnings(schedule, by_hour):
    out = []
    for task, start, _ in schedule:
        temp, rainy, windy = _conditions(task, start, by_hour)
        tid, ttype = task["task_id"], task["task_type"]
        if rainy:
            out.append({"task_id": tid, "message_key": "warn.rain_slippery", "slots": {"task_type": ttype}})
            if ttype == "Trenching":
                out.append({"task_id": tid, "message_key": "warn.rain_trench_edge",
                            "slots": {"distance_m": TRENCH_EDGE_M}})
        if windy and ttype in WIND_CAUTION_TASKS:
            out.append({"task_id": tid, "message_key": "warn.wind_caution", "slots": {"task_type": ttype}})
        if temp is not None and temp > HOT_C:
            out.append({"task_id": tid, "message_key": "warn.heat_hydration", "slots": {"temperature_c": temp}})
    return out


def day_plan(tasks: list[dict], weather: list[dict]) -> dict:
    by_hour = _weather_by_hour(weather)
    ordered = order_tasks(tasks, weather)
    slots = sorted(t["scheduled_hour"] for t in tasks)
    schedule = timeline(ordered, slots)
    return {
        "tasks_ordered": [t["task_id"] for t in ordered],
        "breaks": plan_breaks(schedule, by_hour),
        "condition_warnings": condition_warnings(schedule, by_hour),
    }
