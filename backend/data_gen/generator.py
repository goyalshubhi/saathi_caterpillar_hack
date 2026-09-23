"""Synthetic data generator (fixed seed). Calibrated loosely to the given tables.

Writes to data/synthetic/:
  tasks.csv          400 past task records (Task fields + actual_time_min)
  telemetry.csv      15-min TelemetryWindows: 3 operators x 2 machines x 14 days
  weather_today.csv  mock hourly forecast for "today"
and refreshes the small committed JSON fixtures in data/fixtures/.
"""
import json
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from .today import todays_tasks, todays_weather

REPO_ROOT = Path(__file__).resolve().parents[2]
SYNTHETIC_DIR = REPO_ROOT / "data" / "synthetic"
FIXTURES_DIR = REPO_ROOT / "data" / "fixtures"

TASK_TYPES = ["Earth Excavation", "Trenching", "Material Loading", "Grading", "Demolition"]
BASE_ESTIMATE = {  # CAT estimate range (min) per task type
    "Earth Excavation": (45, 90), "Trenching": (30, 60), "Material Loading": (20, 45),
    "Grading": (25, 50), "Demolition": (60, 120),
}
WEATHERS = ["Sunny", "Cloudy", "Rainy", "Windy"]
WEATHER_P = [0.4, 0.25, 0.2, 0.15]
TEMP_RANGE = {"Sunny": (26, 42), "Cloudy": (22, 34), "Rainy": (20, 28), "Windy": (20, 32)}
SKILLS = ["Beginner", "Intermediate", "Expert"]
SKILL_P = [0.25, 0.45, 0.30]

# Multipliers on the CAT estimate, derived from the pattern of the given tasks table
# (Beginner +40%, Rainy/Windy +15%, Expert slightly under estimate).
SKILL_MULT = {"Beginner": 1.30, "Intermediate": 1.03, "Expert": 0.95}
WEATHER_MULT = {"Sunny": 1.00, "Cloudy": 1.03, "Rainy": 1.08, "Windy": 1.07}
AGE_PER_YEAR = 0.012        # per year above 2 years
HEAT_PER_DEG = 0.010        # per degree above 30 C
AFTERNOON_MULT = 1.04       # 13:00-16:59
NOISE_SD = 0.03

OPERATORS = ["OP1001", "OP1002", "OP1003"]
MACHINES = {"EXC001": 1180.0, "EXC002": 640.0}   # machine -> starting engine hours
SHIFT_STARTS = [6, 14, 22]
WINDOWS_PER_SHIFT = 32
TELEMETRY_START = datetime(2025, 4, 17)
TELEMETRY_DAYS = 14
TS_FORMAT = "%Y-%m-%d %H:%M:%S"


def time_multiplier(task_type, weather, temperature_c, operator_skill, machine_age_yrs, scheduled_hour):
    """Ground-truth multiplier used to create synthetic actual times (the model never sees this)."""
    m = SKILL_MULT[operator_skill] * WEATHER_MULT[weather]
    m *= 1 + AGE_PER_YEAR * (machine_age_yrs - 2)
    m *= 1 + HEAT_PER_DEG * max(0.0, temperature_c - 30)
    if 13 <= scheduled_hour <= 16:
        m *= AFTERNOON_MULT
    # Interactions (not single multipliers): rain hurts trenching extra; heat hurts beginners extra.
    if weather == "Rainy" and task_type == "Trenching":
        m *= 1.03
    if operator_skill == "Beginner" and temperature_c > 35:
        m *= 1.05
    return m


def generate_tasks(rng, n=400):
    rows = []
    for i in range(n):
        task_type = TASK_TYPES[rng.integers(len(TASK_TYPES))]
        weather = WEATHERS[rng.choice(len(WEATHERS), p=WEATHER_P)]
        lo, hi = TEMP_RANGE[weather]
        temperature_c = int(rng.integers(lo, hi + 1))
        skill = SKILLS[rng.choice(len(SKILLS), p=SKILL_P)]
        age = int(rng.integers(1, 11))
        lo, hi = BASE_ESTIMATE[task_type]
        estimate = int(rng.integers(lo, hi + 1) // 5 * 5)
        hour = int(rng.integers(6, 18))
        mult = time_multiplier(task_type, weather, temperature_c, skill, age, hour)
        actual = estimate * mult * (1 + rng.normal(0, NOISE_SD))
        rows.append({
            "task_id": f"S{i + 1:04d}", "task_type": task_type, "weather": weather,
            "temperature_c": temperature_c, "operator_skill": skill, "machine_age_yrs": age,
            "estimated_time_min": estimate, "scheduled_hour": hour, "status": "done",
            "actual_time_min": int(round(actual)),
        })
    return pd.DataFrame(rows)


def _normal_window(rng):
    idle = int(rng.integers(1, 5))
    cycles = int(rng.integers(2, 5))
    return {
        "idle": idle, "cycles": cycles, "fuel": 0.1 + 0.3 * cycles + 0.03 * idle + rng.normal(0, 0.05),
        "belt": "Fastened" if rng.random() > 0.02 else "Unfastened", "alert": "No",
        "prox": float(rng.uniform(6, 30)), "active": True,
    }


def _shift_windows(rng):
    """Window specs for one 8 h shift with random idle stretches, lapses and late drift."""
    w = [_normal_window(rng) for _ in range(WINDOWS_PER_SHIFT)]
    if rng.random() < 0.6:  # idle stretch, sometimes unbuckling during it
        start, length = int(rng.integers(4, 24)), int(rng.integers(1, 4))
        unbelted = rng.random() < 0.5
        for k in range(start, start + length):
            idle = int(rng.integers(12, 16))
            w[k].update(idle=idle, cycles=0, fuel=0.03 * idle, active=False,
                        belt="Unfastened" if unbelted else "Fastened")
        if unbelted and rng.random() < 0.3:  # resumes work still unbelted
            w[start + length]["belt"] = "Unfastened"
    for k in range(WINDOWS_PER_SHIFT):
        if w[k]["active"] and rng.random() < 0.02:  # fuel burned without work
            w[k].update(cycles=0, idle=int(rng.integers(3, 7)), fuel=float(rng.uniform(1.2, 2.0)))
        if rng.random() < 0.02:  # proximity alert
            w[k].update(prox=float(rng.uniform(1, 3)), alert="Yes")
        elif rng.random() < 0.01:  # other alert
            w[k]["alert"] = "Yes"
    if rng.random() < 0.25:  # fatigue-like drift in the last hour or so
        n = int(rng.integers(4, 7))
        for j, k in enumerate(range(WINDOWS_PER_SHIFT - n, WINDOWS_PER_SHIFT)):
            if not w[k]["active"]:
                continue
            idle = min(12, 4 + j + int(rng.integers(0, 2)))
            cycles = max(1, 3 - j // 2)
            w[k].update(idle=idle, cycles=cycles, fuel=0.1 + 0.3 * cycles + 0.03 * idle,
                        belt="Unfastened" if rng.random() < 0.4 else w[k]["belt"])
            if rng.random() < 0.1:
                w[k]["alert"] = "Yes"
    return w


def generate_telemetry(rng):
    rows = []
    engine_hours = dict(MACHINES)
    for day in range(TELEMETRY_DAYS):
        for s, start_hour in enumerate(SHIFT_STARTS):
            for m_idx, machine in enumerate(MACHINES):
                operator = OPERATORS[(day + s + m_idx) % len(OPERATORS)]
                t0 = TELEMETRY_START + timedelta(days=day, hours=start_hour)
                for k, spec in enumerate(_shift_windows(rng)):
                    engine_hours[machine] += 0.25
                    rows.append(window_row(t0 + timedelta(minutes=15 * k), machine, operator,
                                           engine_hours[machine], spec))
    return pd.DataFrame(rows)


def window_row(ts, machine_id, operator_id, engine_hours, spec):
    """Build one TelemetryWindow dict from a compact spec."""
    return {
        "timestamp": ts.strftime(TS_FORMAT), "machine_id": machine_id, "operator_id": operator_id,
        "engine_hours": round(engine_hours, 2), "fuel_used_l": round(max(0.05, spec["fuel"]), 2),
        "load_cycles": int(spec["cycles"]), "idling_time_min": int(spec["idle"]),
        "seatbelt_status": spec["belt"], "safety_alert_triggered": spec["alert"],
        "proximity_distance_m": round(spec["prox"], 1), "machine_active": bool(spec["active"]),
    }


def generate_all(seed: int = 42) -> None:
    rng = np.random.default_rng(seed)
    SYNTHETIC_DIR.mkdir(parents=True, exist_ok=True)
    generate_tasks(rng).to_csv(SYNTHETIC_DIR / "tasks.csv", index=False)
    generate_telemetry(rng).to_csv(SYNTHETIC_DIR / "telemetry.csv", index=False)
    pd.DataFrame(todays_weather()).to_csv(SYNTHETIC_DIR / "weather_today.csv", index=False)
    write_fixtures()


def write_fixtures():
    """Small committed JSON fixtures (frontend fixture mode / tests). Deterministic, no RNG."""
    from .scenarios import scenario  # local import: scenarios imports this module
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    for name, data in {
        "todays_tasks.json": todays_tasks(), "todays_weather.json": todays_weather(),
        "scenario_demo.json": scenario("demo"), "scenario_clean.json": scenario("clean"),
    }.items():
        (FIXTURES_DIR / name).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
