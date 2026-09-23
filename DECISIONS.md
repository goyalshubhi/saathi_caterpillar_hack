# Decisions

- [services] Python 3.14 is what is installed locally; code stays 3.11-compatible (no 3.12+ only syntax).
- [services] UI (M6/M7) deferred per phase change; Makefile has `test-js` instead of `test-frontend`, and `demo-cli` (headless) instead of a UI `demo`; no `test-e2e` yet.
- [services] Service-side test fixtures live in `contracts/examples/` (data/fixtures is intel's folder).
- [services] Single root `requirements.txt` for the whole backend (includes pandas/scikit-learn/joblib for intel).
- [services] Makefile uses `PY ?= python` so it works on Windows Git Bash and elsewhere (`make PY=python3`).
- [services] API imports intel functions only via `backend/api/intel.py`, which switches between stand-ins and real modules with `USE_STANDINS`.
