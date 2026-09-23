import math

from backend.data_gen import todays_tasks, todays_weather
from backend.planner import day_plan


def _task(tid, ttype, hour, minutes=45, weather="Sunny", temp=28):
    return {"task_id": tid, "task_type": ttype, "weather": weather, "temperature_c": temp,
            "operator_skill": "Intermediate", "machine_age_yrs": 3, "estimated_time_min": minutes,
            "scheduled_hour": hour, "status": "pending"}


def _flat_weather(temp, rain=False, wind=10):
    return [{"hour": h, "temperature_c": temp, "rain": rain, "wind_kmh": wind} for h in range(6, 20)]


def _keys(plan, task_id):
    return [w["message_key"] for w in plan["condition_warnings"] if w["task_id"] == task_id]


def _busy_hours(plan, tasks):
    """Hours occupied by tasks when run back-to-back in plan order from the scheduled slots."""
    by_id = {t["task_id"]: t for t in tasks}
    slots = sorted(t["scheduled_hour"] for t in tasks)
    busy, free_from = set(), 0
    for tid, slot in zip(plan["tasks_ordered"], slots):
        start = max(slot, free_from)
        end = start + max(1, math.ceil(by_id[tid]["estimated_time_min"] / 60))
        busy |= set(range(start, end))
        free_from = end
    return busy


def test_contract_fields():
    plan = day_plan(todays_tasks(), todays_weather())
    assert set(plan) == {"tasks_ordered", "breaks", "condition_warnings"}
    assert sorted(plan["tasks_ordered"]) == ["T101", "T102", "T103"]
    assert all(set(b) == {"hour", "reason"} for b in plan["breaks"])
    assert all(set(w) == {"task_id", "message_key", "slots"} for w in plan["condition_warnings"])


def test_rain_trenching_gets_slippery_and_trench_edge_warnings():
    plan = day_plan(todays_tasks(), todays_weather())
    assert {"warn.rain_slippery", "warn.rain_trench_edge"} <= set(_keys(plan, "T101"))


def test_rain_from_hourly_forecast_counts():
    tasks = [_task("A", "Grading", 9)]
    plan = day_plan(tasks, _flat_weather(24, rain=True))
    assert "warn.rain_slippery" in _keys(plan, "A")


def test_windy_demolition_always_gets_warning():
    for weather, temp in [("Windy", 20), ("Windy", 38), ("Sunny", 28)]:
        tasks = [_task("D", "Demolition", 10, weather=weather, temp=temp)]
        wind = 10 if weather == "Windy" else 40          # windy via task field or via forecast
        for forecast in (_flat_weather(temp, wind=wind), []):
            plan = day_plan(tasks, forecast)
            if weather == "Windy" or forecast:
                assert "warn.wind_caution" in _keys(plan, "D"), (weather, temp, forecast != [])


def test_calm_day_has_no_wind_warning():
    plan = day_plan([_task("D", "Demolition", 10)], _flat_weather(28, wind=10))
    assert "warn.wind_caution" not in _keys(plan, "D")


def test_hot_task_gets_hydration_warning():
    plan = day_plan(todays_tasks(), todays_weather())
    heat = [w for w in plan["condition_warnings"] if w["message_key"] == "warn.heat_hydration"]
    assert heat and all(w["slots"]["temperature_c"] > 35 for w in heat)
    cool = day_plan([_task("A", "Grading", 9)], _flat_weather(26))
    assert cool["condition_warnings"] == []


def test_breaks_never_overlap_tasks():
    cases = [
        (todays_tasks(), todays_weather()),
        ([_task("A", "Trenching", 7, 120), _task("B", "Grading", 10, 50), _task("C", "Demolition", 13, 150)],
         _flat_weather(30)),
        ([_task("A", "Trenching", 6, 60), _task("B", "Grading", 9, 60), _task("C", "Material Loading", 12, 60)],
         _flat_weather(39)),
    ]
    for tasks, weather in cases:
        plan = day_plan(tasks, weather)
        busy = _busy_hours(plan, tasks)
        assert plan["breaks"], tasks
        assert not busy & {b["hour"] for b in plan["breaks"]}


def test_breaks_every_two_hours_and_earlier_when_hot():
    tasks = [_task("A", "Trenching", 6, 60), _task("B", "Material Loading", 9, 60),
             _task("C", "Material Loading", 12, 60), _task("D", "Material Loading", 15, 60)]
    mild = day_plan(tasks, _flat_weather(28))
    hot = day_plan(tasks, _flat_weather(39))
    assert all(b["reason"] == "regular" for b in mild["breaks"])
    assert all(b["reason"] == "heat" for b in hot["breaks"])
    assert hot["breaks"][0]["hour"] < mild["breaks"][0]["hour"]
    gaps = [b["hour"] for b in mild["breaks"]]
    assert all(later - earlier <= 4 for earlier, later in zip(gaps, gaps[1:]))


def test_todays_plan_has_heat_break_in_afternoon():
    plan = day_plan(todays_tasks(), todays_weather())
    assert any(b["reason"] == "heat" and b["hour"] >= 13 for b in plan["breaks"])


def test_empty_inputs():
    assert day_plan([], []) == {"tasks_ordered": [], "breaks": [], "condition_warnings": []}
    plan = day_plan(todays_tasks(), [])
    assert len(plan["tasks_ordered"]) == 3 and plan["breaks"]
