# Contracts (source of truth)

Every module talks through these shapes. Examples live in `examples/`. Changing a contract means updating this file, the examples and every consumer in the same change.

Conventions: telemetry timestamps use the given CSV style `YYYY-MM-DD HH:MM:SS`; timestamps written by the API stores (incidents, memory notes) are ISO 8601 `YYYY-MM-DDTHH:MM:SS`, local time, no timezone. Minutes are numbers (int or float). Enum values are the exact strings listed.

## Task (`examples/task.json`, `examples/tasks_today.json`)
`{task_id, task_type, weather, temperature_c, operator_skill, machine_age_yrs, estimated_time_min, scheduled_hour, status}`
- task_type ∈ Earth Excavation | Trenching | Material Loading | Grading | Demolition
- weather ∈ Sunny | Rainy | Cloudy | Windy
- operator_skill ∈ Beginner | Intermediate | Expert
- status ∈ pending | in_progress | done
- scheduled_hour is an int from 0 to 23

## Weather (`examples/weather_today.json`) — returned by `todays_weather()` and `GET /weather/today`
List of hourly entries: `[{hour, temperature_c, rain, wind_kmh}]`, where rain is a bool.

## TelemetryWindow, 15 min (`examples/telemetry_window.json`)
`{timestamp, machine_id, operator_id, engine_hours, fuel_used_l, load_cycles, idling_time_min, seatbelt_status, safety_alert_triggered, proximity_distance_m, machine_active}`
- seatbelt_status ∈ Fastened | Unfastened (as in the given CSV)
- safety_alert_triggered ∈ Yes | No (as in the given CSV)
- proximity_distance_m is a number or null. machine_active is a bool.

## Scenario
- `scenario(name)` (intel) returns `[TelemetryWindow]`. Names: `demo`, `clean`, `fatigue` (P1). Unknown names raise `KeyError`.
- `GET /telemetry/scenario/{name}` wraps it as `{name, task_id, windows}` (`examples/scenario_demo.json`). task_id is the first task in today's plan, which is the task the replay covers.
The `demo` scenario must contain, in order: active and belted work, then an idle stretch of ≥ 2 windows (unbelted while idle), then a resume while still unbelted, then belted work, then one window with `safety_alert_triggered = Yes` and a proximity under 5 m.

## Prediction (`examples/prediction.json`, `examples/debrief.json`)
`{task_id, cat_estimate_min, predicted_min, uncontrollable_min, controllable_min, top_factors: [{name, minutes}]}`
- `predict(task)`: controllable_min = 0.
- `debrief(task, windows)`: the overrun against the CAT estimate is `uncontrollable_min + controllable_min` (this is "9 minutes over" in the demo).
- top_factors[].name ∈ weather | temperature | machine_age | operator_skill | time_of_day

## BehaviorFinding (`examples/behavior_findings.json`)
`{type, severity, window_timestamp, message_key, slots}`
- type ∈ excessive_idling | fuel_without_work | unbelted_active | repeated_alerts | fatigue_drift
- severity ∈ low | medium | high
- message_key = `finding.<type>`. Slots: excessive_idling `{minutes}`, fuel_without_work `{fuel_l, load_cycles}`, unbelted_active `{minutes}`, repeated_alerts `{count, minutes}`, fatigue_drift `{}`

## DayPlan (`examples/day_plan.json`)
`{tasks_ordered: [task_id], breaks: [{hour, reason}], condition_warnings: [{task_id, message_key, slots}]}`
- breaks[].reason ∈ regular | heat
- condition_warnings message keys: `warn.rain_slippery` `{task_type}`, `warn.rain_trench_edge` `{distance_m}`, `warn.wind_caution` `{task_type}`, `warn.heat_hydration` `{temperature_c}`

## Incident (`examples/incident.json`)
`{id, machine_id, timestamp, category, note, source}`
- category ∈ near_miss | person_in_zone | machine_issue | other. source ∈ tap | voice.
- **Never contains operator_id.**

## MemoryNote (`examples/memory_note.json`)
`{id, machine_id, created_at, expires_at, message_key, slots}`. expires_at is created_at + 48 h. Expired notes are never returned.
- Logging an incident writes a note automatically: `message_key = memory_incident`, slots `{category}`.
- **Never contains operator_id.**

## SaathiEvent (`examples/saathi_event.json`)
`{priority, mode, message_key, slots, lang}`
- priority ∈ safety | care | coaching | info. mode ∈ friendly | alert | care | debrief. lang ∈ en | hi.

## Message keys
Every `message_key` above must exist in `frontend/src/voice/templates.js`. A test enforces this for the examples.
