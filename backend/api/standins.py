"""Fixture-backed stand-ins with the exact signatures of the intel modules.

Used while USE_STANDINS is True. Delete once backend.data_gen / ml / planner pass their tests.
"""
import copy
import json

from backend.api.config import CONTRACT_EXAMPLES

GIVEN_TASKS = [
    {"task_id": "T001", "task_type": "Earth Excavation", "weather": "Sunny", "operator_skill": "Expert", "machine_age_yrs": 2, "estimated_time_min": 60, "actual_time_min": 58},
    {"task_id": "T002", "task_type": "Trenching", "weather": "Rainy", "operator_skill": "Intermediate", "machine_age_yrs": 4, "estimated_time_min": 45, "actual_time_min": 52},
    {"task_id": "T003", "task_type": "Material Loading", "weather": "Cloudy", "operator_skill": "Beginner", "machine_age_yrs": 3, "estimated_time_min": 30, "actual_time_min": 42},
    {"task_id": "T004", "task_type": "Grading", "weather": "Sunny", "operator_skill": "Expert", "machine_age_yrs": 5, "estimated_time_min": 35, "actual_time_min": 33},
    {"task_id": "T005", "task_type": "Demolition", "weather": "Windy", "operator_skill": "Intermediate", "machine_age_yrs": 6, "estimated_time_min": 90, "actual_time_min": 105},
]

GIVEN_USAGE = [
    {"timestamp": "2025-05-01 08:00:00", "machine_id": "EXC001", "operator_id": "OP1001", "engine_hours": 1523.5, "fuel_used_l": 5.2, "load_cycles": 12, "idling_time_min": 30, "seatbelt_status": "Fastened", "safety_alert_triggered": "No"},
    {"timestamp": "2025-05-01 10:00:00", "machine_id": "EXC001", "operator_id": "OP1001", "engine_hours": 1524.8, "fuel_used_l": 3.8, "load_cycles": 2, "idling_time_min": 55, "seatbelt_status": "Unfastened", "safety_alert_triggered": "Yes"},
    {"timestamp": "2025-05-01 14:00:00", "machine_id": "EXC001", "operator_id": "OP1001", "engine_hours": 1526.5, "fuel_used_l": 6.1, "load_cycles": 10, "idling_time_min": 15, "seatbelt_status": "Fastened", "safety_alert_triggered": "No"},
    {"timestamp": "2025-05-02 09:00:00", "machine_id": "EXC001", "operator_id": "OP1001", "engine_hours": 1530.2, "fuel_used_l": 2.0, "load_cycles": 1, "idling_time_min": 60, "seatbelt_status": "Unfastened", "safety_alert_triggered": "Yes"},
]


def _example(name):
    with open(CONTRACT_EXAMPLES / name, encoding="utf-8") as f:
        return json.load(f)


# backend.data_gen
def load_given_tasks():
    return copy.deepcopy(GIVEN_TASKS)


def load_given_usage():
    return copy.deepcopy(GIVEN_USAGE)


def generate_all(seed=42):
    return {"seed": seed, "tasks": 0, "windows": 0}


def todays_tasks():
    return _example("tasks_today.json")


def todays_weather():
    return _example("weather_today.json")


def scenario(name):
    if name != "demo":
        raise KeyError(name)
    return _example("scenario_demo.json")


# backend.ml
def train_all():
    return {"standins": True}


def predict(task):
    if task["task_id"] == "T101":
        return _example("prediction.json")
    extra = round(task["estimated_time_min"] * 0.1)
    return {"task_id": task["task_id"], "cat_estimate_min": task["estimated_time_min"],
            "predicted_min": task["estimated_time_min"] + extra, "uncontrollable_min": extra,
            "controllable_min": 0, "top_factors": [{"name": "temperature", "minutes": extra}]}


def debrief(task, windows):
    result = _example("debrief.json")
    result["task_id"] = task["task_id"]
    return result


def findings(windows):
    return _example("behavior_findings.json") if windows else []


# backend.planner
def day_plan(tasks, weather):
    return _example("day_plan.json")
