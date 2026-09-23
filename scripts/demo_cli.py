"""Headless demo: walks PLAN.md demo steps 1-7 through the real API (no UI).

Starts from a fresh, temporary SQLite database. Every line Saathi would say is rendered from
frontend/src/voice/templates.js (exported to scripts/out/templates.json by export_templates.mjs),
in Hindi and English. In-task lines come from the real JS replay engine via scripts/replay_cli.mjs.

Run: make demo-cli
"""
import json
import re
import subprocess
import sys
import tempfile
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

warnings.filterwarnings("ignore", message="Using `httpx`")
from fastapi.testclient import TestClient  # noqa: E402

from backend.api import config  # noqa: E402
from backend.api.main import create_app  # noqa: E402

MACHINE = "EXC001"
TEMPLATES_JSON = ROOT / "scripts" / "out" / "templates.json"


# ---------- rendering (mirrors render() in templates.js) ----------

def load_templates():
    if not TEMPLATES_JSON.exists():
        sys.exit("scripts/out/templates.json missing - run: node scripts/export_templates.mjs")
    return json.loads(TEMPLATES_JSON.read_text(encoding="utf-8"))


T = None


def translate(value, lang):
    if isinstance(value, list):
        parts = [translate(v, lang) for v in value]
        if len(parts) <= 1:
            return "".join(parts)
        return f"{', '.join(parts[:-1])} {T['and'][lang]} {parts[-1]}"
    if isinstance(value, str) and value in T["vocab"]:
        return T["vocab"][value][lang]
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value)


def render(key, slots, lang):
    if key not in T["templates"]:
        raise KeyError(f"Unknown message key: {key}")
    text = T["templates"][key].get(lang) or T["templates"][key]["en"]
    return re.sub(r"\{(\w+)\}", lambda m: translate(slots[m.group(1)], lang)
                  if slots.get(m.group(1)) is not None else m.group(0), text)


SPOKEN = []  # every line said during the run: {message_key, slots, mode, priority, text: {hi, en}}
ECHO = True


def out(*args):
    if ECHO:
        print(*args)


def say(key, slots=None, mode="friendly", priority="info"):
    slots = slots or {}
    text = {"hi": render(key, slots, "hi"), "en": render(key, slots, "en")}
    SPOKEN.append({"message_key": key, "slots": slots, "mode": mode, "priority": priority, "text": text})
    out(f"   [{priority}/{mode}] {key}")
    out(f"      hi: {text['hi']}")
    out(f"      en: {text['en']}")


def step(n, title):
    out(f"\n=== Step {n}: {title} ===")


def ok(resp):
    if resp.status_code >= 400:
        raise RuntimeError(f"{resp.request.method} {resp.request.url} -> {resp.status_code}: {resp.text}")
    return resp.json()


def mins(x):
    return int(round(x))


# ---------- demo ----------

def morning(api, operator):
    tasks = ok(api.get("/tasks/today"))
    weather = ok(api.get("/weather/today"))
    plan = ok(api.get("/plan/today"))
    notes = ok(api.get(f"/memory/{MACHINE}"))
    by_id = {t["task_id"]: t for t in tasks}
    out(f"   operator {operator} on {MACHINE} (operator id stays on the device; never sent to the stores)")
    say("shift_hello", {"machine_id": MACHINE})
    for note in notes:
        say(note["message_key"], note["slots"], mode="alert", priority="safety")
    say("greeting", {"count": len(tasks)})
    for n, task_id in enumerate(plan["tasks_ordered"], 1):
        pred = ok(api.get(f"/predict/{task_id}"))
        say("task_card", {"n": n, "task_type": by_id[task_id]["task_type"], "predicted_min": mins(pred["predicted_min"])})
    hourly = weather
    if any(h["rain"] for h in hourly if h["hour"] <= 10):
        say("rain_today")
    max_temp = max(h["temperature_c"] for h in hourly)
    if max_temp >= 33:
        say("heat_today", {"max_temp": mins(max_temp)}, mode="care", priority="care")
    say("plan_order", {"order": [by_id[t]["task_type"] for t in plan["tasks_ordered"]]})
    if plan["breaks"]:
        say("breaks_planned", {"hours": [b["hour"] for b in plan["breaks"]]})
    return tasks, plan, notes


def run_replay(scenario):
    proc = subprocess.run(["node", str(ROOT / "scripts" / "replay_cli.mjs"), "hi"], input=json.dumps(scenario),
                          capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(proc.stdout)


def main(echo=True):
    """Run the demo; returns the list of spoken lines (see SPOKEN)."""
    global T, ECHO
    ECHO = echo
    SPOKEN.clear()
    sys.stdout.reconfigure(encoding="utf-8")
    T = load_templates()
    out(f"Saathi headless demo  (intel source: {'STAND-INS' if config.USE_STANDINS else 'real modules'})")

    with tempfile.TemporaryDirectory() as tmp, TestClient(create_app(db_path=str(Path(tmp) / "demo.db"))) as api:
        given = ok(api.get("/data/given"))
        out(f"Given data loaded: {len(given['tasks'])} task rows, {len(given['usage'])} usage rows")

        step(1, "Morning briefing (Hindi first)")
        tasks, plan, _ = morning(api, "OP1001")

        scenario = ok(api.get("/telemetry/scenario/demo"))
        task = next(t for t in tasks if t["task_id"] == scenario["task_id"])

        step(2, f"Pre-task: {task['task_type']} ({task['task_id']})")
        pred = ok(api.get(f"/predict/{task['task_id']}"))
        say("pretask_estimate", {"task_type": task["task_type"], "weather": task["weather"],
                                 "cat_min": mins(pred["cat_estimate_min"]), "predicted_min": mins(pred["predicted_min"])},
            priority="info")
        for w in plan["condition_warnings"]:
            if w["task_id"] == task["task_id"]:
                say(w["message_key"], w["slots"], mode="alert", priority="safety")

        step(3, f"In-task replay, fast-forward ({len(scenario['windows'])} windows of 15 min)")
        for e in run_replay(scenario):
            out(f"   {e['timestamp']}  {e['type']}")
            for s in e["saathi"]:
                say(s["message_key"], s["slots"], mode=s["mode"], priority=s["priority"])

        step(4, "Incident: operator taps 'person in zone'")
        inc = ok(api.post("/incidents", json={"machine_id": MACHINE, "category": "person_in_zone", "source": "tap"}))
        say("incident_logged", {"category": inc["category"]}, priority="info")
        for i in ok(api.get("/incidents", params={"machine_id": MACHINE})):
            out(f"   incident list: #{i['id']} {i['timestamp']} {i['category']} ({i['source']})")

        step(5, "Debrief")
        d = ok(api.post("/debrief", json={"task_id": task["task_id"], "windows": scenario["windows"]}))
        over = mins(d["uncontrollable_min"] + d["controllable_min"])
        if over > 0:
            factors = [f["name"] for f in sorted(d["top_factors"], key=lambda f: -f["minutes"]) if f["minutes"] > 0][:2]
            say("debrief_over", {"over_min": over, "uncontrollable_min": mins(d["uncontrollable_min"]),
                                 "controllable_min": mins(d["controllable_min"]), "factors": factors}, mode="debrief")
            if d["uncontrollable_min"] >= d["controllable_min"]:
                say("debrief_not_your_fault", mode="debrief")
        else:
            say("debrief_on_time", mode="debrief")
        findings = ok(api.post("/behavior/analyze", json={"windows": scenario["windows"]}))
        for f in findings:
            out(f"   finding: {f['type']} ({f['severity']}) at {f['window_timestamp']}")
            say(f["message_key"], f["slots"], mode="debrief")

        step(6, "Shift 2: different operator, same machine")
        _, _, notes = morning(api, "OP1002")
        if not notes:
            raise RuntimeError("Machine Memory did not carry the incident to the next shift")

        step(7, "(P1) Fatigue drift -> care mode break")
        r = api.get("/telemetry/scenario/fatigue")
        if r.status_code == 404:
            out("   skipped: no 'fatigue' scenario available yet (P1)")
        else:
            fatigue = [f for f in ok(api.post("/behavior/analyze", json={"windows": ok(r)["windows"]}))
                       if f["type"] == "fatigue_drift"]
            if fatigue:
                say(fatigue[0]["message_key"], fatigue[0]["slots"], mode="care", priority="care")
                say("care_break", mode="care", priority="care")
            else:
                out("   no fatigue drift detected in the 'fatigue' scenario")

    out("\nDemo complete.")
    return list(SPOKEN)


if __name__ == "__main__":
    main()
