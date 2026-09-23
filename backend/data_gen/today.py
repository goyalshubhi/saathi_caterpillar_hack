"""Fixed "today" for the demo: three tasks and an hourly forecast (light rain early, hot afternoon)."""

TODAY = "2025-05-03"

_TASKS = [
    {"task_id": "T101", "task_type": "Trenching", "weather": "Rainy", "temperature_c": 26,
     "operator_skill": "Intermediate", "machine_age_yrs": 4, "estimated_time_min": 45,
     "scheduled_hour": 8, "status": "pending"},
    {"task_id": "T102", "task_type": "Material Loading", "weather": "Cloudy", "temperature_c": 32,
     "operator_skill": "Intermediate", "machine_age_yrs": 4, "estimated_time_min": 30,
     "scheduled_hour": 11, "status": "pending"},
    {"task_id": "T103", "task_type": "Grading", "weather": "Sunny", "temperature_c": 38,
     "operator_skill": "Intermediate", "machine_age_yrs": 4, "estimated_time_min": 35,
     "scheduled_hour": 14, "status": "pending"},
]

# hour: (temperature_c, rain, wind_kmh)
_WEATHER = {
    6: (23, True, 8), 7: (24, True, 9), 8: (26, True, 10), 9: (27, False, 10),
    10: (30, False, 11), 11: (32, False, 12), 12: (34, False, 12), 13: (36, False, 13),
    14: (38, False, 14), 15: (39, False, 14), 16: (37, False, 12), 17: (35, False, 10),
    18: (33, False, 9),
}


def todays_tasks() -> list[dict]:
    return [dict(t) for t in _TASKS]


def todays_weather() -> list[dict]:
    return [{"hour": h, "temperature_c": t, "rain": r, "wind_kmh": w} for h, (t, r, w) in _WEATHER.items()]
