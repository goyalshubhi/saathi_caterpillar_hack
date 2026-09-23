import pytest

from backend.data_gen import generate_all, load_given_tasks, scenario, todays_tasks
from backend.ml import debrief, findings, predict, train_all
from backend.ml import drift, estimator

PREDICTION_FIELDS = {"task_id", "cat_estimate_min", "predicted_min", "uncontrollable_min",
                     "controllable_min", "top_factors"}
FINDING_FIELDS = {"type", "severity", "window_timestamp", "message_key", "slots"}
FINDING_TYPES = {"excessive_idling", "fuel_without_work", "unbelted_active", "repeated_alerts", "fatigue_drift"}


@pytest.fixture(scope="module", autouse=True)
def trained():
    generate_all(seed=42)
    train_all()


def _types(found):
    return {f["type"] for f in found}


# ---------- estimator ----------

def test_model_saved_and_predicts_plausibly():
    assert estimator.MODEL_PATH.exists()
    for task in todays_tasks() + load_given_tasks():
        p = predict(task)
        assert set(p) == PREDICTION_FIELDS
        assert 0.8 * task["estimated_time_min"] <= p["predicted_min"] <= 1.8 * task["estimated_time_min"]


def test_given_tasks_close_to_actual():
    errors = [abs(predict(t)["predicted_min"] - t["actual_time_min"]) / t["actual_time_min"]
              for t in load_given_tasks()]
    assert sum(errors) / len(errors) < 0.1


def test_rain_slower_than_sunny():
    task = todays_tasks()[0]
    rainy = predict(dict(task, weather="Rainy"))["predicted_min"]
    sunny = predict(dict(task, weather="Sunny"))["predicted_min"]
    assert rainy > sunny


def test_worse_conditions_take_longer():
    task = dict(todays_tasks()[2], weather="Sunny")
    assert predict(dict(task, temperature_c=42))["predicted_min"] > predict(dict(task, temperature_c=25))["predicted_min"]
    assert predict(dict(task, operator_skill="Beginner"))["predicted_min"] > predict(dict(task, operator_skill="Expert"))["predicted_min"]


def test_counterfactual_parts_sum():
    for task in todays_tasks() + load_given_tasks():
        p = predict(task)
        assert p["controllable_min"] == 0.0
        assert round(sum(f["minutes"] for f in p["top_factors"]), 1) == p["uncontrollable_min"]
        assert all(set(f) == {"name", "minutes"} for f in p["top_factors"])


def test_ideal_conditions_have_no_uncontrollable_part():
    task = dict(todays_tasks()[0], weather="Sunny", temperature_c=25, machine_age_yrs=2)
    p = predict(task)
    assert p["uncontrollable_min"] == 0.0 and p["top_factors"] == []


def test_given_task_without_temperature_or_hour():
    p = predict(load_given_tasks()[1])  # T002: no temperature_c / scheduled_hour in the given table
    assert p["task_id"] == "T002" and p["cat_estimate_min"] == 45


def test_demo_prediction_and_debrief_story():
    trench = todays_tasks()[0]
    p = predict(trench)
    assert 50 <= p["predicted_min"] <= 54                      # "Saathi expects ~52"
    d = debrief(trench, scenario("demo"))
    assert set(d) == PREDICTION_FIELDS
    assert 5 <= d["uncontrollable_min"] <= 7                   # "about 6 from rain and machine age"
    assert {f["name"] for f in d["top_factors"]} == {"weather", "machine_age"}
    assert 2 <= d["controllable_min"] <= 4                     # "about 3 from idle gaps"
    assert 8 <= d["uncontrollable_min"] + d["controllable_min"] <= 10   # "9 minutes over"
    assert round(sum(f["minutes"] for f in d["top_factors"]), 1) == d["uncontrollable_min"]


def test_debrief_clean_shift_has_no_controllable_part():
    d = debrief(todays_tasks()[0], scenario("clean"))
    assert d["controllable_min"] == 0.0
    assert debrief(todays_tasks()[0], [])["controllable_min"] == 0.0


def test_debrief_never_negative():
    good = dict(todays_tasks()[0], weather="Sunny", temperature_c=22, machine_age_yrs=1)
    d = debrief(good, scenario("clean"))
    assert d["uncontrollable_min"] >= 0 and d["controllable_min"] >= 0


def test_predictions_are_deterministic():
    task = todays_tasks()[0]
    first = predict(task)
    train_all()
    assert predict(task) == first


# ---------- behaviour rules ----------

def _clean(n=8):
    return scenario("clean")[:n]


def test_clean_fixture_has_no_findings():
    assert findings(scenario("clean")) == []


def test_findings_contract_fields():
    found = findings(scenario("demo"))
    assert found
    for f in found:
        assert set(f) == FINDING_FIELDS and f["type"] in FINDING_TYPES
        assert f["message_key"] == f"finding.{f['type']}" and isinstance(f["slots"], dict)
        assert f["severity"] in {"low", "medium", "high"}
    assert [f["window_timestamp"] for f in found] == sorted(f["window_timestamp"] for f in found)


def test_excessive_idling_rule():
    w = _clean()
    w[3] = dict(w[3], idling_time_min=13, load_cycles=0, machine_active=False)
    w[4] = dict(w[4], idling_time_min=14, load_cycles=0, machine_active=False)
    found = [f for f in findings(w) if f["type"] == "excessive_idling"]
    assert len(found) == 1 and found[0]["window_timestamp"] == w[3]["timestamp"]
    assert found[0]["slots"]["minutes"] == 27


def test_fuel_without_work_rule():
    w = _clean()
    w[2] = dict(w[2], load_cycles=0, fuel_used_l=1.5)                    # fuel, zero loads
    w[5] = dict(w[5], load_cycles=1, fuel_used_l=2.0)                    # fuel/cycle >> median
    found = [f for f in findings(w) if f["type"] == "fuel_without_work"]
    assert [f["window_timestamp"] for f in found] == [w[2]["timestamp"], w[5]["timestamp"]]


def test_idle_fuel_is_not_fuel_without_work():
    w = _clean()
    w[3] = dict(w[3], idling_time_min=15, load_cycles=0, fuel_used_l=0.45, machine_active=False)
    assert "fuel_without_work" not in _types(findings(w))


def test_unbelted_active_rule():
    w = _clean()
    w[1] = dict(w[1], seatbelt_status="Unfastened", machine_active=False)  # unbelted while idle: fine
    w[2] = dict(w[2], seatbelt_status="Unfastened")
    w[3] = dict(w[3], seatbelt_status="Unfastened")
    found = [f for f in findings(w) if f["type"] == "unbelted_active"]
    assert len(found) == 1 and found[0]["window_timestamp"] == w[2]["timestamp"]
    assert found[0]["slots"]["minutes"] == 30 and found[0]["severity"] == "high"


def test_repeated_alerts_rule():
    w = _clean()
    w[1] = dict(w[1], safety_alert_triggered="Yes")
    w[4] = dict(w[4], safety_alert_triggered="Yes")      # 45 min later -> repeated
    found = [f for f in findings(w) if f["type"] == "repeated_alerts"]
    assert len(found) == 1 and found[0]["window_timestamp"] == w[4]["timestamp"]
    far = _clean()
    far[0] = dict(far[0], safety_alert_triggered="Yes")
    far[6] = dict(far[6], safety_alert_triggered="Yes")  # 90 min apart -> not repeated
    assert "repeated_alerts" not in _types(findings(far))


def test_rules_are_per_operator():
    a = _clean(4)
    b = [dict(x, operator_id="OP1002") for x in _clean(4)]
    a[1] = dict(a[1], safety_alert_triggered="Yes")
    b[2] = dict(b[2], safety_alert_triggered="Yes")
    assert "repeated_alerts" not in _types(findings(a + b))


def test_demo_scenario_findings():
    types = _types(findings(scenario("demo")))
    assert {"excessive_idling", "unbelted_active", "fuel_without_work"} <= types


# ---------- P1: fatigue drift ----------

def _drifting():
    """Clean shift whose last hour shows rising idle and seatbelt lapses."""
    w = scenario("clean")
    for i, (idle, belt) in enumerate([(5, "Unfastened"), (6, "Fastened"), (7, "Unfastened"), (8, "Unfastened")]):
        k = len(w) - 4 + i
        w[k] = dict(w[k], idling_time_min=idle, seatbelt_status=belt, load_cycles=2,
                    fuel_used_l=round(0.7 + 0.03 * idle, 2))
    return w


def _drift(found):
    return [f for f in found if f["type"] == "fatigue_drift"]


def test_drift_model_trained():
    assert drift.MODEL_PATH.exists()
    assert drift._get_model() is not None


def test_drift_fires_on_demo_late_shift():
    demo = scenario("demo")
    found = _drift(findings(demo))
    assert len(found) == 1
    assert found[0]["window_timestamp"] >= demo[-4]["timestamp"]            # inside the last hour
    assert set(found[0]) == FINDING_FIELDS and found[0]["message_key"] == "finding.fatigue_drift"


def test_drift_not_before_late_shift_in_demo():
    demo = scenario("demo")
    for n in range(1, len(demo) - 1):                                       # replayed window by window
        assert not _drift(findings(demo[:n])), demo[n - 1]["timestamp"]


def test_drift_silent_on_clean_fixture():
    assert not _drift(findings(scenario("clean")))
    assert not drift.fatigue_drift(scenario("clean"), use_model=False)


def test_drift_fires_on_crafted_fixture():
    assert _drift(findings(_drifting()))
    assert drift.fatigue_drift(_drifting(), use_model=False)


def test_drift_rule_fallback_on_demo(monkeypatch):
    monkeypatch.setattr(drift, "_model", None)
    monkeypatch.setattr(drift, "MODEL_PATH", drift.MODEL_PATH.with_name("missing.joblib"))
    found = _drift(findings(scenario("demo")))
    assert len(found) == 1 and found[0]["window_timestamp"] >= scenario("demo")[-4]["timestamp"]
    assert not _drift(findings(scenario("clean")))


def test_drift_needs_enough_history():
    assert not _drift(findings(_drifting()[-4:]))


# ---------- fatigue vs harder work (throughput / lapse gate) ----------

def _last_hour(w, rows):
    """Replace the last len(rows) windows with (idle, cycles, fuel_per_cycle, belt) rows."""
    w = list(w)
    for i, (idle, cycles, fpc, belt) in enumerate(rows):
        k = len(w) - len(rows) + i
        w[k] = dict(w[k], idling_time_min=idle, load_cycles=cycles, seatbelt_status=belt,
                    fuel_used_l=round(0.1 + fpc * cycles + 0.03 * idle, 2))
    return w


def _hard_terrain(fpc=1.2, idle=7):
    """Belted, careful work on harder ground: costlier, slower cycles, but throughput kept."""
    return _last_hour(scenario("clean"), [(idle, 3, fpc, "Fastened")] * 4)


def test_harder_terrain_is_not_fatigue():
    w = _hard_terrain()
    _, last = drift._split_last_hour(w)
    assert drift._model_flags(drift._get_model(), last)          # the forest alone would flag it...
    assert not _drift(findings(w))                               # ...the gate keeps Care mode quiet
    for fpc in (0.6, 1.0, 1.5, 2.0):
        for idle in (3, 5, 9):
            assert not _drift(findings(_hard_terrain(fpc, idle))), (fpc, idle)


def test_belted_fatigue_with_falling_throughput_still_fires():
    w = _last_hour(scenario("clean"), [(6, 1, 0.3, "Fastened"), (7, 1, 0.3, "Fastened"),
                                       (8, 1, 0.3, "Fastened"), (9, 1, 0.3, "Fastened")])
    assert _drift(findings(w))


def test_throughput_ratio_and_gate():
    clean = [x for x in scenario("clean") if x["machine_active"]]
    earlier, last = clean[:-4], clean[-4:]
    assert drift.throughput_ratio(earlier, last) == 1.0
    assert not drift.looks_like_fatigue(earlier, last)
    slow = [dict(x, load_cycles=2) for x in last]
    assert drift.throughput_ratio(earlier, slow) <= drift.THROUGHPUT_DROP
    assert drift.looks_like_fatigue(earlier, slow)
    lapses = [dict(x, seatbelt_status="Unfastened") for x in last[:drift.GATE_MIN_LAPSES]] + last[drift.GATE_MIN_LAPSES:]
    assert drift.looks_like_fatigue(earlier, lapses)
    assert drift.throughput_ratio([], last) is None


def test_gate_keeps_demo_and_crafted_drift():
    demo = scenario("demo")
    earlier, last = drift._split_last_hour(demo)
    assert drift.looks_like_fatigue(earlier, last)
    assert _drift(findings(demo)) and _drift(findings(_drifting()))


# ---------- debrief wording: no attribution for trivial overruns ----------

from backend.ml import MIN_ATTRIBUTION_OVERRUN_MIN, debrief_lines  # noqa: E402


def _pred(unc, ctl, factors=(("weather", None),)):
    return {"task_id": "T1", "cat_estimate_min": 45, "predicted_min": 45 + unc, "uncontrollable_min": unc,
            "controllable_min": ctl, "top_factors": [{"name": n, "minutes": m if m is not None else unc} for n, m in factors]}


def _keys(lines):
    return [line["message_key"] for line in lines]


def test_slightly_over_gets_numbers_only_no_attribution():
    assert MIN_ATTRIBUTION_OVERRUN_MIN == 3
    for unc, ctl in [(1.0, 0.0), (1.5, 0.4), (0.8, 1.2), (2.9, 0.0)]:
        lines = debrief_lines(_pred(unc, ctl))
        assert _keys(lines) == ["debrief_near_time"], (unc, ctl)
        assert "debrief_not_your_fault" not in _keys(lines) and "debrief_over" not in _keys(lines)
        assert lines[0]["slots"] == {"over_min": round(unc + ctl)}


def test_on_time_is_neutral():
    assert _keys(debrief_lines(_pred(0.0, 0.0, factors=()))) == ["debrief_on_time"]
    assert _keys(debrief_lines(_pred(0.3, 0.1))) == ["debrief_on_time"]      # rounds to 0 minutes


def test_attribution_from_threshold_up():
    assert _keys(debrief_lines(_pred(3.0, 0.0))) == ["debrief_over", "debrief_not_your_fault"]
    assert _keys(debrief_lines(_pred(1.0, 4.0))) == ["debrief_over"]         # mostly controllable: no excuse


def test_demo_debrief_lines_unchanged():
    d = debrief(todays_tasks()[0], scenario("demo"))
    lines = debrief_lines(d)
    assert _keys(lines) == ["debrief_over", "debrief_not_your_fault"]
    assert lines[0]["slots"] == {"over_min": 9, "uncontrollable_min": 6, "controllable_min": 3,
                                 "factors": ["weather", "machine_age"]}


# ---------- cold start: first tracked shift ----------

from backend.ml import finding_lines, operator_history  # noqa: E402
from backend.ml import history  # noqa: E402


def test_operator_history_counts_past_shifts():
    for op in ("OP1001", "OP1002", "OP1003"):
        h = operator_history(op)
        assert h["history_available"] and h["shift_count"] == 28          # 84 shifts / 3 operators
    assert operator_history("OP9999") == {"operator_id": "OP9999", "shift_count": 0, "history_available": False}


def test_first_shift_debrief_uses_neutral_template():
    d = debrief(todays_tasks()[0], scenario("demo"))
    assert _keys(debrief_lines(d, history_available=False)) == ["debrief_over_first_shift", "debrief_not_your_fault"]
    assert _keys(debrief_lines(d, history_available=True)) == ["debrief_over", "debrief_not_your_fault"]
    assert debrief_lines(d, False)[0]["slots"] == debrief_lines(d, True)[0]["slots"]
    assert _keys(debrief_lines(_pred(1.0, 0.5), history_available=False)) == ["debrief_near_time"]


def test_first_shift_drift_line_is_neutral_other_findings_unchanged():
    found = findings(scenario("demo"))
    first = _keys(finding_lines(found, history_available=False))
    usual = _keys(finding_lines(found, history_available=True))
    assert "finding.fatigue_drift_first_shift" in first and "finding.fatigue_drift" not in first
    assert usual == [f["message_key"] for f in found]
    assert [k for k in first if "fatigue" not in k] == [k for k in usual if "fatigue" not in k]


def test_new_operator_gets_no_drift_until_two_hours():
    # Deliberate: fewer than MIN_HISTORY (8) windows -> no drift judgement at all.
    late = _drifting()
    assert not _drift(findings(late[-(drift.MIN_HISTORY - 1):]))
    assert drift.MIN_HISTORY == 8
    assert history.SHIFT_GAP.total_seconds() == 900
