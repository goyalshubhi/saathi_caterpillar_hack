# CLAUDE.md

Full plan: `PLAN.md`. Decisions log: `DECISIONS.md` (one line each).

## Working rules (follow these strictly)

1. **Work autonomously.** Do not ask me questions unless you are truly blocked (missing credential, irreversible action, or two options that change the product). For everything else, pick the simplest reasonable option, write it in `DECISIONS.md` (one line each), and keep going.
2. **Do not overcomplicate.** No Docker, no auth, no Redux/state libraries, no database server, no websockets, no microservices, no LLM calls, no paid APIs, no API keys. Plain, readable code over clever code. If a feature can be a lookup table or a rule, make it one.
3. **Priority order is law.** Finish and test all **P0** items and the full P0 demo before touching P1. Finish P1 before P2. Never leave P0 broken to start something new.
4. **Test as you go.** Every module gets unit tests written alongside it. Run that module's tests before moving on. After each phase, run the full integration test. Do not mark anything done while a test fails.
5. **Contracts first.** Modules talk only through the data contracts defined below. Do not change a contract silently — if you must, update `contracts/` and every consumer in the same change.
6. **Keep the demo runnable at all times.** After each phase, `make demo` (or the documented equivalent) must start the app and the scripted demo must play end to end.
7. **Honesty in the product.** Synthetic data is labeled as synthetic (a small note on an About screen). Never show a manager view. Never claim real-time cycle detection.

## Ownership (two-person team, parallel Claude sessions)

- **Phase change:** the frontend UI (M6 Avatar, M7 Screens) is deferred to a later phase. Ignore it.
- **Intel session (this one):** owns `data/`, `backend/data_gen/` (M1), `backend/ml/` (M2), `backend/planner/` (M3), and the tests `backend/tests/test_data_gen.py`, `test_ml.py`, `test_planner.py`.
- **Teammate session:** owns the skeleton, `contracts/`, `backend/api/`, voice engine, replay engine, `frontend/`, `scripts/`, `Makefile`. The Intel session never creates or edits those.
- Libraries for Intel modules: pandas, scikit-learn, joblib, pytest only.
- Everything deterministic (fixed seeds; the `demo` scenario is identical on every run).
- Decisions by the Intel session go in `DECISIONS.md` prefixed `[intel]`.

### Fixed interface (the API calls these; do not rename or change arguments)

```
backend.data_gen: load_given_tasks(), load_given_usage(), generate_all(seed=42),
                  todays_tasks(), todays_weather(), scenario(name)
backend.ml:       train_all(), predict(task), debrief(task, windows), findings(windows)
backend.planner:  day_plan(tasks, weather)
```
Return plain dicts/lists whose field names match the contracts in `PLAN.md` exactly.

### Running Intel tests

```
python -m pytest backend/tests/test_data_gen.py backend/tests/test_ml.py backend/tests/test_planner.py
```
(`python -m` puts the repo root on `sys.path` so `import backend` works.)
