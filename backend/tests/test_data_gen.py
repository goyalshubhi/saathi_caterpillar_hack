import json

import pandas as pd
import pytest

from backend.data_gen import (
    SchemaError, generate_all, load_given_tasks, load_given_usage, scenario, todays_tasks,
    todays_weather,
)
from backend.data_gen import generator
from backend.data_gen.loaders import TASK_COLUMNS, USAGE_COLUMNS, load_given_tasks as load_tasks_from

TASK_FIELDS = {"task_id", "task_type", "weather", "temperature_c", "operator_skill", "machine_age_yrs",
               "estimated_time_min", "scheduled_hour", "status"}
WINDOW_FIELDS = {"timestamp", "machine_id", "operator_id", "engine_hours", "fuel_used_l", "load_cycles",
                 "idling_time_min", "seatbelt_status", "safety_alert_triggered", "proximity_distance_m",
                 "machine_active"}


def test_given_tables_load_exactly():
    tasks = load_given_tasks()
    usage = load_given_usage()
    assert len(tasks) == 5 and len(usage) == 4
    assert list(tasks[0]) == TASK_COLUMNS and list(usage[0]) == USAGE_COLUMNS
    assert tasks[1] == {"task_id": "T002", "task_type": "Trenching", "weather": "Rainy",
                        "operator_skill": "Intermediate", "machine_age_yrs": 4,
                        "estimated_time_min": 45, "actual_time_min": 52}
    assert usage[1]["idling_time_min"] == 55 and usage[1]["engine_hours"] == 1524.8
    assert isinstance(usage[0]["load_cycles"], int)


def test_loader_rejects_wrong_schema(tmp_path):
    bad = tmp_path / "tasks.csv"
    bad.write_text("task_id,task_type\nT1,Grading\n")
    with pytest.raises(SchemaError, match="expected columns"):
        load_tasks_from(bad)
    bad.write_text(",".join(TASK_COLUMNS) + "\nT1,Grading,Snowy,Expert,2,30,31\n")
    with pytest.raises(SchemaError, match="weather"):
        load_tasks_from(bad)
    with pytest.raises(SchemaError, match="not found"):
        load_tasks_from(tmp_path / "missing.csv")


@pytest.fixture(scope="module")
def generated():
    generate_all(seed=42)
    return {name: (generator.SYNTHETIC_DIR / name).read_bytes()
            for name in ["tasks.csv", "telemetry.csv", "weather_today.csv"]}


def test_generator_is_deterministic(generated):
    generate_all(seed=42)
    for name, content in generated.items():
        assert (generator.SYNTHETIC_DIR / name).read_bytes() == content, name


def test_generator_seed_changes_output(generated):
    generate_all(seed=7)
    try:
        assert (generator.SYNTHETIC_DIR / "tasks.csv").read_bytes() != generated["tasks.csv"]
    finally:
        generate_all(seed=42)


def test_synthetic_tasks_ranges(generated):
    df = pd.read_csv(generator.SYNTHETIC_DIR / "tasks.csv")
    assert 300 <= len(df) <= 450
    assert TASK_FIELDS | {"actual_time_min"} <= set(df.columns)
    ratio = df.actual_time_min / df.estimated_time_min
    assert ratio.between(0.8, 1.8).all()
    # Pattern from the given table: beginners slower than experts, rain slower than sun.
    assert ratio[df.operator_skill == "Beginner"].mean() > ratio[df.operator_skill == "Expert"].mean() + 0.2
    assert ratio[df.weather == "Rainy"].mean() > ratio[df.weather == "Sunny"].mean()
    assert df.scheduled_hour.between(6, 17).all() and df.machine_age_yrs.between(1, 10).all()


def test_synthetic_telemetry_ranges(generated):
    df = pd.read_csv(generator.SYNTHETIC_DIR / "telemetry.csv")
    assert set(df.columns) == WINDOW_FIELDS
    assert len(df) == 3 * 2 * 14 * 32
    assert set(df.operator_id) == {"OP1001", "OP1002", "OP1003"}
    assert set(df.machine_id) == {"EXC001", "EXC002"}
    assert df.idling_time_min.between(0, 15).all() and (df.fuel_used_l > 0).all()
    assert (df.load_cycles >= 0).all() and (df.proximity_distance_m > 0).all()
    for _, g in df.groupby("machine_id"):
        assert g.sort_values("timestamp").engine_hours.is_monotonic_increasing
    # the interesting behaviours exist but are rare
    assert 0 < (~df.machine_active).mean() < 0.2
    assert 0 < (df.safety_alert_triggered == "Yes").mean() < 0.1
    assert ((df.seatbelt_status == "Unfastened") & df.machine_active).any()
    assert ((df.load_cycles == 0) & df.machine_active & (df.fuel_used_l > 1.0)).any()


def test_todays_tasks_and_weather():
    tasks = todays_tasks()
    assert [t["task_type"] for t in tasks] == ["Trenching", "Material Loading", "Grading"]
    assert all(set(t) == TASK_FIELDS and t["status"] == "pending" for t in tasks)
    trench = tasks[0]
    assert trench["weather"] == "Rainy" and trench["estimated_time_min"] == 45
    weather = todays_weather()
    assert all(set(w) == {"hour", "temperature_c", "rain", "wind_kmh"} for w in weather)
    by_hour = {w["hour"]: w for w in weather}
    assert by_hour[8]["rain"] and max(by_hour[h]["temperature_c"] for h in range(13, 17)) > 35
    assert by_hour[8]["temperature_c"] < by_hour[14]["temperature_c"]


def test_demo_scenario_story():
    w = scenario("demo")
    assert w == scenario("demo")
    assert all(set(x) == WINDOW_FIELDS for x in w)
    idle = [i for i, x in enumerate(w) if not x["machine_active"]]
    resume = idle[-1] + 1
    alerts = [i for i, x in enumerate(w) if x["safety_alert_triggered"] == "Yes"]
    assert idle and idle[0] >= 2                              # normal work first
    assert w[resume]["seatbelt_status"] == "Unfastened"        # resumes unbelted
    assert alerts and alerts[0] > resume and w[alerts[0]]["proximity_distance_m"] < 3
    last_hour, earlier = w[-4:], w[:-4]
    unbelted_late = sum(x["seatbelt_status"] == "Unfastened" for x in last_hour)
    assert unbelted_late >= 2
    assert [x["idling_time_min"] for x in last_hour] == sorted(x["idling_time_min"] for x in last_hour)
    early_active = [x["idling_time_min"] for x in earlier if x["machine_active"]]
    assert sum(x["idling_time_min"] for x in last_hour) / 4 > sum(early_active) / len(early_active)


def test_clean_scenario_is_clean():
    w = scenario("clean")
    assert all(x["machine_active"] and x["seatbelt_status"] == "Fastened"
               and x["safety_alert_triggered"] == "No" for x in w)
    with pytest.raises(KeyError):
        scenario("nope")


def test_committed_fixtures_match_code():
    fixtures = generator.FIXTURES_DIR
    assert json.loads((fixtures / "scenario_demo.json").read_text()) == scenario("demo")
    assert json.loads((fixtures / "scenario_clean.json").read_text()) == scenario("clean")
    assert json.loads((fixtures / "todays_tasks.json").read_text()) == todays_tasks()
    assert json.loads((fixtures / "todays_weather.json").read_text()) == todays_weather()
