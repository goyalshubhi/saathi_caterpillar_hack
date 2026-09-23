"""Phase 1 gate: the demo flow end to end through the API.

given data -> plan -> predict -> replay scenario -> findings -> log incident
-> memory note for the next shift -> debrief split sums correctly.
Runs against whatever intel source USE_STANDINS selects.
"""
import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.api.main import create_app

MACHINE = "EXC001"


class Clock:
    def __init__(self):
        self.t = datetime(2026, 9, 23, 9, 30)

    def __call__(self):
        return self.t


@pytest.fixture(scope="module")
def clock():
    return Clock()


@pytest.fixture(scope="module")
def api(tmp_path_factory, clock):
    db = tmp_path_factory.mktemp("flow") / "flow.db"
    with TestClient(create_app(db_path=str(db), now=clock)) as c:
        yield c


def test_demo_flow(api, clock):
    # 1. given data is ingested in the exact brief schema
    given = api.get("/data/given").json()
    assert [t["task_id"] for t in given["tasks"]] == ["T001", "T002", "T003", "T004", "T005"]
    assert len(given["usage"]) == 4

    # 2. plan covers every task and has breaks
    tasks = api.get("/tasks/today").json()
    plan = api.get("/plan/today").json()
    assert sorted(plan["tasks_ordered"]) == sorted(t["task_id"] for t in tasks)
    assert plan["breaks"]

    # 3. the demo scenario task gets a prediction above the CAT estimate (rainy trenching)
    scenario = api.get("/telemetry/scenario/demo").json()
    task = next(t for t in tasks if t["task_id"] == scenario["task_id"])
    assert task["task_type"] == "Trenching" and task["weather"] == "Rainy"
    pred = api.get(f"/predict/{task['task_id']}").json()
    assert pred["cat_estimate_min"] == task["estimated_time_min"]
    assert pred["predicted_min"] > pred["cat_estimate_min"]
    assert any(w["task_id"] == task["task_id"] and w["message_key"].startswith("warn.rain") for w in plan["condition_warnings"])

    # 4. replay scenario has the scripted beats (idle stretch, unbelted resume, proximity alert)
    wins = scenario["windows"]
    idle = [not w["machine_active"] for w in wins]
    resume = [i for i in range(1, len(wins)) if idle[i - 1] and not idle[i]]
    assert resume and wins[resume[0]]["seatbelt_status"] == "Unfastened"
    assert sum(idle[: resume[0]]) >= 2
    alert = [w for w in wins if w["safety_alert_triggered"] == "Yes"]
    assert alert and alert[0]["proximity_distance_m"] is not None and alert[0]["proximity_distance_m"] < 5

    # 5. named findings for the scenario
    findings = api.post("/behavior/analyze", json={"windows": wins}).json()
    types = {f["type"] for f in findings}
    assert {"excessive_idling", "unbelted_active"} <= types

    # 6. incident -> machine memory -> next shift (no operator_id anywhere)
    api.post("/incidents", json={"machine_id": MACHINE, "category": "person_in_zone", "source": "tap",
                                 "operator_id": "OP1001"})
    clock.t += timedelta(hours=8)  # next shift, different operator
    notes = api.get(f"/memory/{MACHINE}").json()
    assert [n["slots"]["category"] for n in notes] == ["person_in_zone"]
    assert "operator_id" not in json.dumps([notes, api.get("/incidents").json()])

    # 7. debrief split
    d = api.post("/debrief", json={"task_id": task["task_id"], "windows": wins}).json()
    assert d["uncontrollable_min"] > 0 and d["controllable_min"] > 0
    assert d["uncontrollable_min"] >= d["controllable_min"]  # "not your fault" story
    over = d["uncontrollable_min"] + d["controllable_min"]
    assert 3 <= over <= 20

    # memory note expires after 48 h
    clock.t += timedelta(hours=41)
    assert api.get(f"/memory/{MACHINE}").json() == []
