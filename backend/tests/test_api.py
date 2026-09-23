"""M4: every endpoint via TestClient, plus the privacy and expiry rules."""
import json
import sqlite3
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from backend.api.main import create_app


class Clock:
    def __init__(self):
        self.t = datetime(2026, 9, 23, 9, 0, 0)

    def __call__(self):
        return self.t


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def db(tmp_path):
    return str(tmp_path / "test.db")


@pytest.fixture
def client(db, clock):
    with TestClient(create_app(db_path=db, now=clock)) as c:
        yield c


TASK_KEYS = {"task_id", "task_type", "weather", "temperature_c", "operator_skill", "machine_age_yrs",
             "estimated_time_min", "scheduled_hour", "status"}
PREDICTION_KEYS = {"task_id", "cat_estimate_min", "predicted_min", "uncontrollable_min", "controllable_min", "top_factors"}
WINDOW_KEYS = {"timestamp", "machine_id", "operator_id", "engine_hours", "fuel_used_l", "load_cycles", "idling_time_min",
               "seatbelt_status", "safety_alert_triggered", "proximity_distance_m", "machine_active"}


def test_health(client):
    assert client.get("/health").json()["ok"] is True


def test_data_given(client):
    body = client.get("/data/given").json()
    assert len(body["tasks"]) == 5 and len(body["usage"]) == 4
    assert body["tasks"][1]["task_type"] == "Trenching"
    assert body["usage"][0]["machine_id"] == "EXC001"


def test_tasks_today(client):
    tasks = client.get("/tasks/today").json()
    assert len(tasks) >= 3
    for t in tasks:
        assert TASK_KEYS <= set(t)
        assert t["status"] in {"pending", "in_progress", "done"}


def test_weather_today(client):
    w = client.get("/weather/today").json()
    assert w and all({"hour", "temperature_c", "rain", "wind_kmh"} <= set(h) for h in w)


def test_plan_today(client):
    plan = client.get("/plan/today").json()
    task_ids = {t["task_id"] for t in client.get("/tasks/today").json()}
    assert set(plan["tasks_ordered"]) == task_ids
    assert all({"hour", "reason"} <= set(b) for b in plan["breaks"])
    assert all({"task_id", "message_key", "slots"} <= set(w) for w in plan["condition_warnings"])


def test_predict(client):
    task_id = client.get("/tasks/today").json()[0]["task_id"]
    p = client.get(f"/predict/{task_id}").json()
    assert PREDICTION_KEYS <= set(p) and p["task_id"] == task_id


def test_predict_unknown_task(client):
    assert client.get("/predict/NOPE").status_code == 404


def test_scenario_and_debrief_and_analyze(client):
    sc = client.get("/telemetry/scenario/demo").json()
    assert sc["windows"] and WINDOW_KEYS <= set(sc["windows"][0])
    d = client.post("/debrief", json={"task_id": sc["task_id"], "windows": sc["windows"]}).json()
    assert PREDICTION_KEYS <= set(d)
    findings = client.post("/behavior/analyze", json={"windows": sc["windows"]}).json()
    assert findings and all({"type", "severity", "window_timestamp", "message_key", "slots"} <= set(f) for f in findings)


def test_unknown_scenario(client):
    assert client.get("/telemetry/scenario/nope").status_code == 404


def test_incident_roundtrip(client):
    r = client.post("/incidents", json={"machine_id": "EXC001", "category": "person_in_zone", "source": "tap"})
    assert r.status_code == 201
    inc = r.json()
    assert set(inc) == {"id", "machine_id", "timestamp", "category", "note", "source"}
    assert client.get("/incidents", params={"machine_id": "EXC001"}).json() == [inc]
    assert client.get("/incidents", params={"machine_id": "EXC999"}).json() == []


def test_incident_bad_category(client):
    r = client.post("/incidents", json={"machine_id": "EXC001", "category": "bogus"})
    assert r.status_code == 422


def test_incident_creates_memory_note(client):
    client.post("/incidents", json={"machine_id": "EXC001", "category": "person_in_zone"})
    notes = client.get("/memory/EXC001").json()
    assert len(notes) == 1
    assert notes[0]["message_key"] == "memory_incident"
    assert notes[0]["slots"] == {"category": "person_in_zone"}


def test_memory_note_expires_after_48h(client):
    note = client.post("/memory/EXC001", json={"message_key": "memory_incident", "slots": {"category": "other"}}).json()
    assert note["expires_at"] == "2026-09-25T09:00:00"
    assert set(note) == {"id", "machine_id", "created_at", "expires_at", "message_key", "slots"}


def test_expired_notes_hidden(client, clock):
    client.post("/memory/EXC001", json={"message_key": "memory_incident", "slots": {"category": "other"}})
    clock.t += timedelta(hours=47)
    client.post("/memory/EXC001", json={"message_key": "memory_incident", "slots": {"category": "near_miss"}})
    assert len(client.get("/memory/EXC001").json()) == 2
    clock.t += timedelta(hours=2)  # first note is now 49 h old
    notes = client.get("/memory/EXC001").json()
    assert [n["slots"]["category"] for n in notes] == ["near_miss"]


def test_no_operator_id_anywhere(client, db):
    client.post("/incidents", json={"machine_id": "EXC001", "category": "near_miss", "operator_id": "OP1001", "note": "x"})
    client.post("/memory/EXC001", json={"message_key": "memory_incident", "slots": {}, "operator_id": "OP1001"})
    responses = [client.get("/incidents").json(), client.get("/memory/EXC001").json()]
    assert "operator_id" not in json.dumps(responses) and "OP1001" not in json.dumps(responses)
    conn = sqlite3.connect(db)
    for table in ("incidents", "memory_notes"):
        cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]
        assert "operator_id" not in cols
        assert "OP1001" not in json.dumps(conn.execute(f"SELECT * FROM {table}").fetchall())
    conn.close()


@pytest.mark.parametrize("text,category", [
    ("a person walked behind the machine", "person_in_zone"),
    ("मशीन के पीछे एक आदमी आ गया", "person_in_zone"),
    ("koi aadmi zone mein tha", "person_in_zone"),
    ("that was a near miss with the truck", "near_miss"),
    ("बाल बाल बचे", "near_miss"),
    ("hydraulic oil leak on the arm", "machine_issue"),
    ("इंजन से धुआं निकल रहा है", "machine_issue"),
    ("the lunch was late", "other"),
])
def test_classify(client, text, category):
    assert client.post("/incidents/classify", json={"text": text}).json()["category"] == category


def test_reset(client):
    client.post("/incidents", json={"machine_id": "EXC001", "category": "other"})
    client.post("/reset")
    assert client.get("/incidents").json() == [] and client.get("/memory/EXC001").json() == []


def test_cors_allows_vite_dev_server(client):
    r = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
