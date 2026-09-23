"""Saathi API (M4). Run: uvicorn backend.api.main:app --reload"""
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.api import config, intel
from backend.api.classify import classify
from backend.api.store import Store


class DebriefIn(BaseModel):
    task_id: str
    windows: list[dict]
    operator_id: Optional[str] = None  # read-only: picks the first-shift wording, never stored


class WindowsIn(BaseModel):
    windows: list[dict]


# Unknown fields (e.g. operator_id) are ignored by pydantic, so they can never be stored.
class IncidentIn(BaseModel):
    machine_id: str
    category: Literal["near_miss", "person_in_zone", "machine_issue", "other"]
    note: str = ""
    source: Literal["tap", "voice"] = "tap"
    timestamp: Optional[str] = None


class NoteIn(BaseModel):
    message_key: str
    slots: dict = {}


class TextIn(BaseModel):
    text: str


def create_app(db_path=None, now=datetime.now, train=True):
    @asynccontextmanager
    async def lifespan(app):
        if train:
            intel.train_all()
        yield

    app = FastAPI(title="Saathi API", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS,
                       allow_methods=["*"], allow_headers=["*"])
    store = Store(db_path or config.DB_PATH, now=now)
    app.state.store = store

    def find_task(task_id):
        for task in intel.todays_tasks():
            if task["task_id"] == task_id:
                return task
        raise HTTPException(404, f"unknown task {task_id}")

    @app.get("/health")
    def health():
        # standins is always False now; kept because the frontend reads it.
        return {"ok": True, "standins": False}

    @app.get("/data/given")
    def data_given():
        return {"tasks": intel.load_given_tasks(), "usage": intel.load_given_usage()}

    @app.get("/tasks/today")
    def tasks_today():
        return intel.todays_tasks()

    @app.get("/weather/today")
    def weather_today():
        return intel.todays_weather()

    @app.get("/plan/today")
    def plan_today():
        return intel.day_plan(intel.todays_tasks(), intel.todays_weather())

    @app.get("/predict/{task_id}")
    def predict(task_id: str):
        return intel.predict(find_task(task_id))

    @app.post("/debrief")
    def debrief(body: DebriefIn):
        # `lines` are ml.debrief_lines(): no attribution below 3 min over, and the CAT-anchored
        # wording on a first tracked shift. Unknown operator = no history (the neutral wording).
        d = intel.debrief(find_task(body.task_id), body.windows)
        history = bool(body.operator_id) and intel.operator_history(body.operator_id)["history_available"]
        return {**d, "lines": intel.debrief_lines(d, history)}

    @app.get("/telemetry/scenario/{name}")
    def scenario(name: str):
        try:
            windows = intel.scenario(name)
        except KeyError:
            raise HTTPException(404, f"unknown scenario {name}")
        # The replay covers the first task of today's plan.
        plan = intel.day_plan(intel.todays_tasks(), intel.todays_weather())
        return {"name": name, "task_id": plan["tasks_ordered"][0], "windows": windows}

    @app.get("/operators/{operator_id}/history")
    def operator_history(operator_id: str):
        # Cold start: how many past shifts exist on this device. Read-only, nothing is stored.
        return intel.operator_history(operator_id)

    @app.post("/behavior/analyze")
    def analyze(body: WindowsIn):
        return intel.findings(body.windows)

    @app.get("/incidents")
    def list_incidents(machine_id: Optional[str] = None):
        return store.list_incidents(machine_id)

    @app.post("/incidents", status_code=201)
    def add_incident(body: IncidentIn):
        return store.add_incident(body.machine_id, body.category, body.note, body.source, body.timestamp)

    @app.post("/incidents/classify")
    def classify_incident(body: TextIn):
        return classify(body.text)

    @app.get("/memory/{machine_id}")
    def list_memory(machine_id: str):
        return store.list_notes(machine_id)

    @app.post("/memory/{machine_id}", status_code=201)
    def add_memory(machine_id: str, body: NoteIn):
        return store.add_note(machine_id, body.message_key, body.slots)

    @app.post("/reset")
    def reset():
        store.reset()
        return {"ok": True}

    return app


app = create_app()
