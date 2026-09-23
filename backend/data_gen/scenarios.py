"""Scripted telemetry scenarios (lists of TelemetryWindow dicts). Hand-written, so identical every run."""
from datetime import datetime, timedelta

from .generator import window_row
from .today import TODAY

MACHINE_ID, OPERATOR_ID, START_ENGINE_HOURS = "EXC001", "OP1001", 1531.0


def _w(idle, cycles, belt="F", alert="No", prox=18.0, active=True, fuel=None):
    return {
        "idle": idle, "cycles": cycles, "belt": "Fastened" if belt == "F" else "Unfastened",
        "alert": alert, "prox": prox, "active": active,
        "fuel": fuel if fuel is not None else 0.1 + 0.3 * cycles + 0.03 * idle,
    }


_NORMAL = [_w(2, 4, prox=18.0), _w(3, 3, prox=22.5), _w(2, 4, prox=15.0), _w(3, 3, prox=19.5)]

# Demo shift 08:00-13:45 on the Trenching day (light rain in the morning).
_DEMO = [
    _NORMAL[0], _NORMAL[1], _NORMAL[2],                  # 08:00-08:30 normal work
    _w(12, 0, prox=25.0, active=False),                  # 08:45 idle stretch (waiting for truck)
    _w(12, 0, belt="U", prox=25.0, active=False),        # 09:00 still idle, operator unbuckles
    _w(3, 3, belt="U", prox=14.0),                       # 09:15 resumes work while unbelted
    _NORMAL[3],                                          # 09:30 belted again
    _w(4, 2, alert="Yes", prox=2.1),                     # 09:45 person close to the machine
    _NORMAL[0], _NORMAL[1],                              # 10:00-10:15
    _w(5, 0, fuel=1.6, prox=20.0),                       # 10:30 engine revving with no loads
    _NORMAL[2], _NORMAL[3],                              # 10:45-11:00
    *_NORMAL, *_NORMAL[:3],                              # 11:15-12:45 normal work
    _w(4, 3, belt="U", prox=16.0),                       # 13:00 last hour: idle rising,
    _w(5, 2, prox=17.0),                                 # 13:15   seatbelt lapses
    _w(6, 2, belt="U", prox=15.5),                       # 13:30
    _w(7, 2, belt="U", prox=16.5),                       # 13:45
]

# Same shift length, nothing unusual: used as the "clean" fixture in tests.
_CLEAN = _NORMAL * 6

SCENARIOS = {"demo": _DEMO, "clean": _CLEAN}


def scenario(name: str) -> list[dict]:
    if name not in SCENARIOS:
        raise KeyError(f"unknown scenario {name!r}; available: {sorted(SCENARIOS)}")
    t0 = datetime.fromisoformat(TODAY) + timedelta(hours=8)
    rows, engine_hours = [], START_ENGINE_HOURS
    for k, spec in enumerate(SCENARIOS[name]):
        engine_hours += 0.25
        rows.append(window_row(t0 + timedelta(minutes=15 * k), MACHINE_ID, OPERATOR_ID, engine_hours, spec))
    return rows
