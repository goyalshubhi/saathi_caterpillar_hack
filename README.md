# Saathi — operator companion for CAT machinery
Setup: Python 3.11+ and Node 18+, then `make setup` (installs requirements.txt and frontend/ Vitest).
Test: `make test` (pytest + Vitest) · API: `make dev` → http://localhost:8000/docs
Demo without UI: `make demo-cli` walks demo steps 1–7 through the real API and prints every line Saathi says (Hindi + English).
Offline voice: `make audio` (needs internet once) re-renders Saathi's lines to MP3 with edge-tts; the committed MP3s play first, speechSynthesis is the fallback.
Modules: M1 data / M2 ML / M3 planner (`backend/data_gen`, `ml`, `planner`) — intel owner · M4 API (`backend/api`), M5 voice (`frontend/src/voice`), M8 replay (`frontend/src/replay`), `contracts/`, `scripts/` — services owner.
UI (M6 avatar, M7 screens) is deferred to a later phase; voice + replay are UI-free ES modules.
Data: the demo uses synthetic data calibrated to the two tables in the brief. Behaviour data never leaves the device; incidents and memory notes never store operator_id.
