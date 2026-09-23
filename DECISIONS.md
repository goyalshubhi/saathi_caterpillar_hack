# Decisions

- [services] Python 3.14 is what is installed locally; code stays 3.11-compatible (no 3.12+ only syntax).
- [services] UI (M6/M7) deferred per phase change; Makefile has `test-js` instead of `test-frontend`, and `demo-cli` (headless) instead of a UI `demo`; no `test-e2e` yet.
- [services] Service-side test fixtures live in `contracts/examples/` (data/fixtures is intel's folder).
- [services] Single root `requirements.txt` for the whole backend (includes pandas/scikit-learn/joblib for intel).
- [services] Makefile uses `PY ?= python` so it works on Windows Git Bash and elsewhere (`make PY=python3`).
- [services] API imports intel functions only via `backend/api/intel.py`, which switches between stand-ins and real modules with `USE_STANDINS`.
- [services] Added GET /weather/today (morning briefing needs heat/rain) and POST /reset (fresh demo state) beyond the PLAN.md endpoint list.
- [services] Scenario contract is `{name, task_id, windows}` so the debrief knows which task the replay belongs to.
- [services] Debrief overrun vs CAT estimate = uncontrollable_min + controllable_min ("9 minutes over" = 6 + 3).
- [services] Logging an incident auto-writes a `memory_incident` MemoryNote for the machine (48 h TTL).
- [services] Voice queue: a safety line cancels a playing coaching/info line (dropped) or care line (replayed after); the budget is used up when a coaching line is accepted, not when quiet mode drops it.
- [services] Speaker renders the event itself so it can switch to the English text when no Hindi voice exists (sets `fallbackToEnglish`).
- [services] Replay idle = machine_active false OR idling_time_min >= 10 in the window; idle lesson plays once per idle stretch once it reaches 10 min.
- [services] demo-cli drives the API in-process with FastAPI TestClient on a temp DB (no server to start); in-task lines come from the real JS replay via scripts/replay_cli.mjs.
- [services] Makefile sets APPDATA via cygpath when MSYS make drops it (otherwise pip --user packages are invisible).
- [services] Contracts aligned to what intel built (PLAN.md left these open): weather is a list `{hour, temperature_c, rain, wind_kmh}`; `scenario()` returns a window list and the API wraps it as `{name, task_id, windows}` with task_id = first task of today's plan; message keys are dotted (`warn.*`, `finding.*`); break reason `regular|heat`; telemetry timestamps in CSV style.
- [services] `contracts/examples/demo_scenario.json` is exported from the real API by `make export-scenario`; the JS integration test replays it through replay -> rules -> queue.
