# Build Plan: Saathi — Operator Companion for CAT Machinery

You are building a hackathon project in ~10 hours. Read this whole file before writing code. Save it as `PLAN.md` in the repo root and create a short `CLAUDE.md` containing the "Working rules" section below so the rules persist across sessions.

---

## Working rules (follow these strictly)

1. **Work autonomously.** Do not ask me questions unless you are truly blocked (missing credential, irreversible action, or two options that change the product). For everything else, pick the simplest reasonable option, write it in `DECISIONS.md` (one line each), and keep going.
2. **Do not overcomplicate.** No Docker, no auth, no Redux/state libraries, no database server, no websockets, no microservices, no LLM calls, no paid APIs, no API keys. Plain, readable code over clever code. If a feature can be a lookup table or a rule, make it one.
3. **Priority order is law.** Finish and test all **P0** items and the full P0 demo before touching P1. Finish P1 before P2. Never leave P0 broken to start something new.
4. **Test as you go.** Every module gets unit tests written alongside it. Run that module's tests before moving on. After each phase, run the full integration test. Do not mark anything done while a test fails.
5. **Contracts first.** Modules talk only through the data contracts defined below. Do not change a contract silently — if you must, update `contracts/` and every consumer in the same change.
6. **Keep the demo runnable at all times.** After each phase, `make demo` (or the documented equivalent) must start the app and the scripted demo must play end to end.
7. **Honesty in the product.** Synthetic data is labeled as synthetic (a small note on an About screen). Never show a manager view. Never claim real-time cycle detection.

---

## Product summary

**Saathi** ("companion" in Hindi) is a voice companion for CAT machine operators. It is a character with an avatar and a voice that changes by situation. It speaks the operator's language (English + Hindi), plans the day around heat and weather, gives safety alerts, turns idle time into short lessons, estimates task time, explains overruns fairly, and passes machine/site notes to the next shift. It is **not a chatbot**: Saathi speaks; the operator only uses a few fixed commands. All behaviour data stays on the device; there is no manager dashboard.

### Brief outcomes → features (every row must be demoable)

| Brief outcome | Feature |
|---|---|
| Daily task dashboard | Icon task cards with predicted time + status; suggested order for the day |
| Safety: seatbelt | Spoken alert when seatbelt unfastened while active; "belt before you move" when work resumes after idle |
| Safety: proximity | Spoken alert from `safety_alert` / assumed `proximity_distance_m` field |
| Safety: incident logging | Tap-to-log (3 icon buttons) + voice logging (P1); incident list screen; incidents saved to Machine Memory |
| Working conditions | Weather/heat/wind change the plan, the time estimate, and the pre-task safety warnings |
| Training hub | Hub screen (Recommended / Library / Completed) + lessons auto-played during idle windows |
| Unusual behaviour | Named findings: excessive idling, fuel burned without work, unbelted while active, repeated alerts; fatigue drift (P1) |
| Task time estimation | Regression model on past data + conditions; shows CAT estimate vs Saathi prediction; "not your fault" debrief |

---

## Tech stack (fixed — do not substitute)

- **Backend:** Python 3.11, FastAPI, pandas, scikit-learn, SQLite via stdlib `sqlite3`. Tests: `pytest` + FastAPI `TestClient`.
- **Frontend:** React + Vite, plain JavaScript (no TypeScript), plain CSS. Tests: Vitest for logic modules.
- **Voice:** browser Web Speech API — `speechSynthesis` for output, `webkitSpeechRecognition` for input (P1). Wrap both so they can be mocked in tests.
- **Avatar:** inline SVG + CSS animations.
- **Weather:** mocked hourly forecast JSON (no network).
- **End-to-end smoke test:** Playwright, one test for the demo flow. If Playwright cannot install, write `docs/MANUAL_TEST.md` with a click-through checklist instead and note it in `DECISIONS.md`.
- **Runner:** a `Makefile` (or `scripts/*.sh` if make is unavailable) with `setup`, `test`, `test-backend`, `test-frontend`, `test-e2e`, `dev`, `demo`.

---

## Repo layout

```
saathi/
  PLAN.md  CLAUDE.md  DECISIONS.md  README.md  Makefile
  contracts/            # JSON examples + schema notes for every contract (source of truth)
  data/
    given/              # the two tables from the brief, transcribed exactly as CSV
    synthetic/          # generated files (gitignored except a small fixture)
    fixtures/           # tiny deterministic fixtures used by tests
  backend/
    data_gen/           # M1
    ml/                 # M2
    planner/            # M3
    api/                # M4 (FastAPI app, memory + incident store)
    tests/
  frontend/
    src/
      voice/            # M5 Saathi voice engine
      avatar/           # M6
      screens/          # M7
      replay/           # M8 telemetry replay player
      api.js            # thin fetch wrapper, can switch to fixtures
    tests/
  e2e/
```

---

## Given data (transcribe exactly into `data/given/`)

`machine_usage.csv`
```
timestamp,machine_id,operator_id,engine_hours,fuel_used_l,load_cycles,idling_time_min,seatbelt_status,safety_alert_triggered
2025-05-01 08:00:00,EXC001,OP1001,1523.5,5.2,12,30,Fastened,No
2025-05-01 10:00:00,EXC001,OP1001,1524.8,3.8,2,55,Unfastened,Yes
2025-05-01 14:00:00,EXC001,OP1001,1526.5,6.1,10,15,Fastened,No
2025-05-02 09:00:00,EXC001,OP1001,1530.2,2.0,1,60,Unfastened,Yes
```

`tasks.csv`
```
task_id,task_type,weather,operator_skill,machine_age_yrs,estimated_time_min,actual_time_min
T001,Earth Excavation,Sunny,Expert,2,60,58
T002,Trenching,Rainy,Intermediate,4,45,52
T003,Material Loading,Cloudy,Beginner,3,30,42
T004,Grading,Sunny,Expert,5,35,33
T005,Demolition,Windy,Intermediate,6,90,105
```

The app must be able to load both files in exactly this schema.

---

## Data contracts (create these in `contracts/` first, with example JSON)

- **Task** `{task_id, task_type, weather, temperature_c, operator_skill, machine_age_yrs, estimated_time_min, scheduled_hour, status}` — status ∈ pending | in_progress | done
- **TelemetryWindow** (15-min) `{timestamp, machine_id, operator_id, engine_hours, fuel_used_l, load_cycles, idling_time_min, seatbelt_status, safety_alert_triggered, proximity_distance_m, machine_active}`
- **Prediction** `{task_id, cat_estimate_min, predicted_min, uncontrollable_min, controllable_min, top_factors: [{name, minutes}]}`
- **BehaviorFinding** `{type, severity, window_timestamp, message_key, slots}` — type ∈ excessive_idling | fuel_without_work | unbelted_active | repeated_alerts | fatigue_drift
- **DayPlan** `{tasks_ordered: [task_id], breaks: [{hour, reason}], condition_warnings: [{task_id, message_key, slots}]}`
- **Incident** `{id, machine_id, timestamp, category, note, source}` — category ∈ near_miss | person_in_zone | machine_issue | other; source ∈ tap | voice. **No operator_id.**
- **MemoryNote** `{id, machine_id, created_at, expires_at, message_key, slots}` — expires 48 h after creation. **No operator_id.**
- **SaathiEvent** `{priority, mode, message_key, slots, lang}` — priority ∈ safety | care | coaching | info; mode ∈ friendly | alert | care | debrief

---

## Modules (independent — one owner each)

Each module: build against contracts + fixtures, write unit tests, pass them, then integrate. Frontend modules use `api.js` fixture mode so they never wait on the backend.

### M1 — Data (backend/data_gen) · Owner A
- Loaders for both given CSVs (validate schema, clear error on mismatch).
- Synthetic generator with a fixed seed:
  - ~300 task records. Actual time = estimate × multipliers derived from the given table's pattern (skill, weather, machine age, plus temperature and time of day) + noise, plus one or two interactions you did not hardcode as single multipliers.
  - 15-min telemetry windows for 3 operators × 2 machines × 14 days. Include realistic idle stretches, occasional unbelted-while-idle then resuming, fuel-without-work windows, rising drift late in some shifts, and `proximity_distance_m`.
  - Mock hourly weather for "today" (temperature, rain, wind).
- **Tests:** schema of given data loads; generator is deterministic for a seed; value ranges sane.

### M2 — ML (backend/ml) · Owner A
- **Time estimator:** `GradientBoostingRegressor` on task features → actual minutes. Save with `joblib`.
- **Counterfactual split:** predict again with ideal conditions (Sunny, 25 °C, same skill, machine age 2) → `uncontrollable_min = predicted - ideal`; controllable = observed idle gap minutes attributable to the task. Top factors = per-factor counterfactual deltas (change one factor to ideal at a time).
- **Behaviour findings (P0, rules):** excessive idling (idle share of window above threshold), fuel without work (fuel per load cycle far above machine's median, or fuel with ~0 cycles), unbelted while active, repeated alerts (≥2 in 1 h).
- **Fatigue drift (P1):** `IsolationForest` on per-window features (idle share, fuel/cycle, seatbelt lapses, alerts) trained on pooled synthetic data, scored per operator; flag when score crosses threshold in the last hour of windows. Keep the rule-based version as fallback.
- **Tests:** model trains and predicts within plausible range; rain > sunny prediction for same task; counterfactual parts sum correctly; each rule fires on a crafted fixture and does not fire on a clean one.

### M3 — Planner (backend/planner) · Owner A or B
- Heat-aware ordering (P1): precision tasks (Trenching, Grading) in cooler hours, heavier-tolerance tasks later; breaks every ~2 h and earlier when temperature > 35 °C.
- P0 fallback: keep scheduled order, still add breaks.
- **Condition-aware safety warnings (P0, rules):** Rainy → slippery ground / trench-edge distance; Windy → demolition and lifting caution; Hot → hydration and breaks.
- **Tests:** hot day moves precision tasks earlier; windy demolition always gets a warning; breaks never overlap tasks.

### M4 — API + stores (backend/api) · Owner B
Endpoints (all JSON, all matching contracts):
- `GET /tasks/today` · `GET /plan/today` · `GET /predict/{task_id}` · `POST /debrief` (task_id + observed windows → Prediction with split)
- `GET /telemetry/scenario/{name}` — returns the scripted demo scenario windows
- `POST /behavior/analyze` → list of BehaviorFinding
- `GET/POST /incidents` · `GET/POST /memory/{machine_id}` (expired notes filtered out)
- `GET /data/given` — returns both given tables (proves ingestion)
- Startup: load or train models; seed SQLite.
- **Tests:** every endpoint via `TestClient`; incidents and memory never contain operator_id; expired notes are hidden.

### M5 — Saathi voice engine (frontend/src/voice) · Owner C
- `templates.js`: every spoken line as a key with `en` and `hi` text and `{slot}` placeholders. Write Hindi yourself; mark the file so a native speaker can review.
- `modes.js`: pitch/rate/volume per mode — friendly (1.0/1.0/0.9), alert (1.3/1.15/1.0), care (0.9/0.85/0.8), debrief (1.0/1.0/0.9). Tune by ear later.
- `speaker.js`: wraps `speechSynthesis`; picks a voice for the language; if no Hindi voice exists, falls back to English and exposes a visible warning flag.
- `queue.js`: priority queue — safety interrupts cut in immediately; care and coaching wait; **interruption budget: max one coaching line per task** (safety exempt); quiet mode mutes coaching only.
- `commands.js` (P1): fixed commands only — repeat, log incident, taking a break, quiet mode — in en/hi.
- **Tests (Vitest, speech mocked):** slots fill correctly in both languages; safety preempts coaching; budget blocks the second coaching line; quiet mode never mutes safety; missing Hindi voice triggers fallback.

### M6 — Avatar (frontend/src/avatar) · Owner C or D
- SVG character in a hard hat with four states: idle, speaking, alert, rest. CSS animations only.
- Shown on morning, break, debrief and hub screens. **Hidden during the in-task screen** (voice only there) — show a small status chip instead.
- P2: pulse per spoken word via `onboundary`.
- **Tests:** renders each state; not rendered on the in-task screen.

### M7 — Screens (frontend/src/screens) · Owner D
Large touch targets, high contrast, icon-first, minimal text, works at tablet width.
- **Morning:** greeting, language picker, task icon cards (type icon, predicted time, status), suggested order, today's conditions.
- **Pre-task:** CAT estimate vs Saathi prediction, condition warnings — spoken.
- **In-task:** driven by M8; status chip; three big incident buttons; no avatar.
- **Break:** avatar in rest state.
- **Debrief:** overrun split (uncontrollable vs controllable), named behaviour findings in plain language, shown once.
- **Training hub:** Recommended (from findings), Library (6–8 lesson cards, each spoken + simple illustration), Completed. Instructor booking = disabled button labeled "coming soon".
- **Incidents:** list of what the operator logged on this machine.
- **About:** "Demo uses synthetic data calibrated to the provided tables. Behaviour data never leaves this device."
- **Tests:** each screen renders with fixture data.

### M8 — Telemetry replay (frontend/src/replay) · Owner B or D
- Plays a scenario's windows at adjustable speed (1×, 10×, 60×), emitting events: window tick, idle start/end, seatbelt change, safety alert, machine resumes after idle.
- Rules on events → SaathiEvents: resume-after-idle + unbelted → "belt before you move"; safety alert → alert mode; idle window > N min → play recommended lesson from hub.
- **Tests:** a fixture scenario produces the expected event sequence and SaathiEvents in order.

---

## Phases and gates

### Phase 0 — Skeleton (≈45 min)
Repo layout, Makefile, contracts with example JSON, given CSVs, fixtures, stub endpoints returning fixture data, frontend shell with routing and fixture mode. **Gate:** `make test` runs (even if few tests), `make dev` shows the shell. After this, all modules can be built in parallel.

### Phase 1 — P0: the must-work demo (≈5 h)
P0 = everything needed for the demo script below, in English + Hindi:
- M1 loaders + generator · M2 estimator + counterfactual + rule-based findings · M3 condition warnings + basic breaks
- M4 all endpoints · M5 templates/modes/speaker/queue · M6 four static states
- M7 Morning, Pre-task, In-task, Debrief, Training hub (Recommended + Library), Incidents, About
- M8 replay with seatbelt, alert, resume-after-idle and idle-lesson events
- Tap-to-log incidents → Machine Memory → next shift's briefing

**Gate:** all unit tests pass; backend integration test `tests/test_demo_flow.py` passes (load given data → plan → predict → replay scenario → findings → log incident → memory note appears for the next shift → debrief split sums correctly); Playwright smoke test passes (or manual checklist completed); `make demo` plays the full script with no console errors. **Do not start Phase 2 until this gate passes.**

### Phase 2 — P1 (≈2.5 h)
Isolation Forest fatigue drift + care-mode break · heat-aware task ordering · voice incident logging (`webkitSpeechRecognition` en-IN / hi-IN → keyword classifier → Incident, operator confirms) · fixed voice commands · Completed section in hub.
**Gate:** all tests + integration + e2e still pass; demo still plays.

### Phase 3 — P2 (only if time remains)
Avatar word sync · Tamil templates · pre-recorded audio fallback for the ~15 most important lines · mic-based volume adaptation.

### Final hour — freeze
No new features. Run everything, fix bugs only, rehearse the demo twice.

---

## Demo script (must run from one "Start demo" button, deterministic seed)

1. **Morning (Hindi):** Saathi greets the operator, reads three task cards, mentions today's heat, suggests order (P0: scheduled order + breaks).
2. **Pre-task:** "Trenching, light rain — CAT estimate 45, Saathi expects ~52 minutes." Plus a rain safety warning.
3. **In-task replay (fast-forward):** idle stretch → short lesson from the hub; machine resumes while unbelted → "belt before you move" (alert mode); proximity alert → alert mode.
4. **Incident:** operator taps "person in zone" → appears in incident list.
5. **Debrief:** "9 minutes over — about 6 from rain and machine age, about 3 from idle gaps." Named findings shown.
6. **Shift 2, different operator, same machine:** morning briefing warns about the logged incident (Machine Memory).
7. (P1) Fatigue drift triggers care mode and a break.

---

## Definition of done

- Every brief outcome row in the table above is visible in the demo.
- `make test` (backend + frontend) and the integration/e2e test pass with zero failures.
- `make demo` works from a fresh clone following README steps.
- No operator_id in incidents, memory notes, or anything outside the device's own history.
- `README.md` explains setup in under 10 lines, lists modules and owners, and states the synthetic-data assumption.

Start with Phase 0 now.