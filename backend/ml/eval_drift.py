"""Evaluate fatigue_drift on the synthetic shifts (the check behind the choices in DECISIONS.md).

Run after generate_all() + train_all():  python -m backend.ml.eval_drift

Ground truth for a synthetic shift: >= 2 of its last 4 windows are working windows with idle >= 5 min
(the generator's late-shift drift). Reports full-shift hits, mid-shift false alarms (every prefix
of every shift that ends before its last hour), the demo/clean/crafted scenarios, and crafted
harder-terrain shifts that must not count as fatigue.
"""
from datetime import datetime

import pandas as pd

from backend.data_gen import scenario
from backend.data_gen.generator import SYNTHETIC_DIR

from .drift import fatigue_drift
from .findings import TS_FORMAT, group_windows


def shifts(windows):
    out, cur = [], []
    for w in windows:
        if cur and (datetime.strptime(w["timestamp"], TS_FORMAT)
                    - datetime.strptime(cur[-1]["timestamp"], TS_FORMAT)).total_seconds() > 900:
            out.append(cur)
            cur = []
        cur.append(w)
    return out + ([cur] if cur else [])


def with_last_hour(rows):
    """Clean shift whose last len(rows) windows become (idle, cycles, fuel_per_cycle, belt)."""
    w = scenario("clean")
    for i, (idle, cycles, fpc, belt) in enumerate(rows):
        k = len(w) - len(rows) + i
        w[k] = dict(w[k], idling_time_min=idle, load_cycles=cycles, seatbelt_status=belt,
                    fuel_used_l=round(0.1 + fpc * cycles + 0.03 * idle, 2))
    return w


def evaluate():
    fires = lambda w: bool(fatigue_drift(w))  # noqa: E731
    recs = pd.read_csv(SYNTHETIC_DIR / "telemetry.csv").to_dict(orient="records")
    groups = [s for g in group_windows(recs) for s in shifts(g)]
    truth = [sum(1 for w in g[-4:] if w["machine_active"] and w["idling_time_min"] >= 5) >= 2 for g in groups]
    hits = [fires(g) for g in groups]
    prefixes = [g[:n] for g in groups for n in range(8, len(g) - 3)]
    demo, clean = scenario("demo"), scenario("clean")
    drifting = with_last_hour([(5, 2, 0.35, "Unfastened"), (6, 2, 0.35, "Fastened"),
                               (7, 2, 0.35, "Unfastened"), (8, 2, 0.35, "Unfastened")])
    terrain = [with_last_hour([(idle, 3, fpc, "Fastened")] * (4 * h))
               for fpc in (0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0) for idle in (3, 5, 7, 9) for h in (1, 2)]
    return {
        "shifts": len(groups), "drift_shifts": sum(truth),
        "true_positives": sum(h and t for h, t in zip(hits, truth)),
        "false_positives": sum(h and not t for h, t in zip(hits, truth)),
        "mid_shift_alarms": sum(fires(p) for p in prefixes), "mid_shift_checks": len(prefixes),
        "demo_fires_at": [demo[n - 1]["timestamp"] for n in range(1, len(demo) + 1) if fires(demo[:n])],
        "clean_fires": any(fires(clean[:n]) for n in range(1, len(clean) + 1)),
        "crafted_drift_fires": fires(drifting),
        "harder_terrain_flagged": sum(fires(t) for t in terrain), "harder_terrain_cases": len(terrain),
    }


if __name__ == "__main__":
    r = evaluate()
    print(f"synthetic shifts: {r['true_positives']}/{r['drift_shifts']} drift shifts caught, "
          f"{r['false_positives']}/{r['shifts'] - r['drift_shifts']} false positives")
    print(f"mid-shift false alarms: {r['mid_shift_alarms']}/{r['mid_shift_checks']} "
          f"({r['mid_shift_alarms'] / r['mid_shift_checks']:.2%})")
    print(f"demo fires at {r['demo_fires_at']}; clean fires: {r['clean_fires']}; crafted drift fires: {r['crafted_drift_fires']}")
    print(f"harder terrain flagged: {r['harder_terrain_flagged']}/{r['harder_terrain_cases']}")
