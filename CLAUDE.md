# CLAUDE.md — Saathi

Full plan: `PLAN.md`. Decisions log: `DECISIONS.md` (one line each, prefixed with your role, e.g. `[services]` or `[intel]`).

## Working rules (follow these strictly)

1. **Work autonomously.** Do not ask me questions unless you are truly blocked (missing credential, irreversible action, or two options that change the product). For everything else, pick the simplest reasonable option, write it in `DECISIONS.md` (one line each), and keep going.
2. **Do not overcomplicate.** No Docker, no auth, no Redux/state libraries, no database server, no websockets, no microservices, no LLM calls, no paid APIs, no API keys. Plain, readable code over clever code. If a feature can be a lookup table or a rule, make it one.
3. **Priority order is law.** Finish and test all **P0** items and the full P0 demo before touching P1. Finish P1 before P2. Never leave P0 broken to start something new.
4. **Test as you go.** Every module gets unit tests written alongside it. Run that module's tests before moving on. After each phase, run the full integration test. Do not mark anything done while a test fails.
5. **Contracts first.** Modules talk only through the data contracts defined below. Do not change a contract silently — if you must, update `contracts/` and every consumer in the same change.
6. **Keep the demo runnable at all times.** After each phase, `make demo` (or the documented equivalent) must start the app and the scripted demo must play end to end.
7. **Honesty in the product.** Synthetic data is labeled as synthetic (a small note on an About screen). Never show a manager view. Never claim real-time cycle detection.


## Current phase

The frontend UI (M6 Avatar, M7 Screens) is **deferred**. Do not set up React, Vite pages, screens, CSS or the avatar. `frontend/src/voice` and `frontend/src/replay` are plain, UI-free ES modules (Vitest tests only) so a React app can import them later.

## Ownership (two parallel Claude sessions — never edit the other side's folders)

- **services** owns: `contracts/`, `backend/api/`, `frontend/src/voice/`, `frontend/src/replay/`, `scripts/`, `Makefile`, `README.md`.
  Builds Phase 0, M4 (API + stores), M5 (voice logic), M8 (replay logic), headless demo runner.
- **intel** owns: `data/`, `backend/data_gen/`, `backend/ml/`, `backend/planner/`.
  Builds M1 data, M2 ML, M3 planner.
- Shared: `backend/tests/` (each side adds its own test files; don't edit the other side's), `requirements.txt`, `DECISIONS.md` (append only).

## Fixed interface (intel implements, `backend/api/intel.py` calls exactly these)

- `backend.data_gen`: `load_given_tasks()`, `load_given_usage()`, `generate_all(seed=42)`, `todays_tasks()`, `todays_weather()`, `scenario(name)`
- `backend.ml`: `train_all()`, `predict(task)`, `debrief(task, windows)`, `findings(windows)`
- `backend.planner`: `day_plan(tasks, weather)`

All return plain dicts/lists using the contract field names in `PLAN.md` / `contracts/`.
The real modules are wired in directly (stand-ins and `USE_STANDINS` were removed after the intel merge). Problems found in the other side's code are reported as a list, not fixed in place.

## Commands

`make setup` · `make test` (pytest + vitest) · `make test-backend` · `make test-js` · `make dev` (API on :8000) · `make demo-cli` (headless demo) · `make audio` (re-render voice MP3s; needs internet)
