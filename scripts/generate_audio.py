"""Pre-generate Saathi's voice lines as MP3 (offline playback) with edge-tts neural voices.

Lines rendered:
  - every line Saathi says in the headless demo (scripts/demo_cli.py, same template rendering), and
  - every phrasing (variant) of each of those lines, and
  - every fixed line (templates without slots: safety alerts, belt-before-you-move, breaks,
    lessons, quiet-mode confirmations ...), plus greetings, memory notes and incident
    confirmations per machine / incident category and the near-time debrief (FIXED_SLOT_LINES), and
  - off-script extras, capped at EXTRA_CLIP_CAP clips: proximity_alert at every whole-metre
    distance of an alert window in the synthetic telemetry or scripted scenarios, then the most
    frequent debrief_over lines from debrief() over every synthetic task (demo shift windows),
in English (en-IN) and Hindi (hi-IN). Each voice mode's pitch/rate/volume from modes.js is mapped
to edge-tts prosody parameters.

Output: frontend/public/audio/{lang}/{hash}.mp3 and frontend/public/audio/manifest.json.
Files are named by a hash of (voice, prosody, text), so unchanged lines are not re-downloaded and
stale files are removed. Needs network access. Run: make audio
"""
import asyncio
import collections
import hashlib
import json
import math
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import demo_cli  # noqa: E402  (reuses its template rendering and demo walk)

AUDIO_DIR = ROOT / "frontend" / "public" / "audio"
VOICES = {"en": "en-IN-PrabhatNeural", "hi": "hi-IN-MadhurNeural"}
LANGS = ("hi", "en")
CONCURRENCY = 4
EXTRA_CLIP_CAP = 150        # off-script extras (clips, all phrasings, en + hi) so `make audio` stays small

# Mode used for fixed lines; matches what the replay rules / demo / UI use for these keys.
ALERT_KEYS = {"belt_before_move", "seatbelt_unfastened", "safety_alert", "proximity_alert", "memory_incident"}
CARE_KEYS = {"break_time", "care_break", "finding.fatigue_drift"}   # drift as spoken on the care break

# Lines with slots that the app says outside the scripted demo run, so they get MP3s too.
MACHINES = ["EXC001", "EXC002"]
CATEGORIES = ["near_miss", "person_in_zone", "machine_issue", "other"]
FIXED_SLOT_LINES = (
    [("shift_hello", {"machine_id": m}) for m in MACHINES]
    + [("memory_incident", {"category": c}) for c in CATEGORIES]
    + [("incident_logged", {"category": c}) for c in CATEGORIES]
    + [("debrief_near_time", {"over_min": m}) for m in (1, 2)]   # below the attribution threshold
)


def default_mode(key):
    if key in ALERT_KEYS or key.startswith("warn."):
        return "alert"
    if key in CARE_KEYS:
        return "care"
    if key.startswith(("debrief_", "finding.")):
        return "debrief"
    return "friendly"


def prosody(mode):
    """modes.js multipliers (1.0 = neutral) -> edge-tts relative values."""
    m = demo_cli.T["modes"].get(mode) or demo_cli.T["modes"]["friendly"]
    return {
        "rate": f"{round((m['rate'] - 1) * 100):+d}%",
        "pitch": f"{round((m['pitch'] - 1) * 100):+d}Hz",
        "volume": f"{round((m['volume'] - 1) * 100):+d}%",
    }


def spoken_distance(m):
    """Mirror of spokenDistance() in frontend/src/replay/rules.js: whole metres, rounded down, >= 1."""
    return max(1, math.floor(m))


def proximity_lines():
    """proximity_alert at every whole-metre distance an alert window can produce."""
    import pandas as pd
    from backend.data_gen import scenario
    from backend.data_gen.generator import SYNTHETIC_DIR
    windows = pd.read_csv(SYNTHETIC_DIR / "telemetry.csv").to_dict(orient="records")
    windows += scenario("demo") + scenario("clean")
    metres = sorted({spoken_distance(w["proximity_distance_m"]) for w in windows
                     if w["safety_alert_triggered"] == "Yes" and w["proximity_distance_m"] is not None
                     and not (isinstance(w["proximity_distance_m"], float) and math.isnan(w["proximity_distance_m"]))})
    return [("proximity_alert", {"distance_m": m}, "alert") for m in metres]


def debrief_over_lines():
    """debrief_over lines from debrief() over every synthetic task, most frequent first."""
    import pandas as pd
    from backend.data_gen import scenario
    from backend.data_gen.generator import SYNTHETIC_DIR
    from backend.ml import debrief, debrief_lines
    shift = scenario("demo")
    counts = collections.Counter()
    for task in pd.read_csv(SYNTHETIC_DIR / "tasks.csv").to_dict(orient="records"):
        for line in debrief_lines(debrief(task, shift)):
            if line["message_key"] == "debrief_over":
                counts[json.dumps(line["slots"], sort_keys=True)] += 1
    return [("debrief_over", json.loads(slots), "debrief") for slots, _ in counts.most_common()]


def collect_lines(extras=True):
    """Unique ((message_key, lang, mode, text), (slots, variant)) pairs: demo lines + fixed lines, all
    phrasings, then the off-script extras up to EXTRA_CLIP_CAP new clips."""
    spoken = demo_cli.main(echo=False)
    lines = {}

    def phrasings(key, slots, mode):
        # every phrasing, so whichever variant the app picks has an MP3
        return {(key, lang, mode, demo_cli.render(key, slots, lang, v)): (slots, v)
                for v in range(demo_cli.variant_count(key)) for lang in LANGS}

    def add(key, slots, mode):
        lines.update(phrasings(key, slots, mode))

    for s in spoken:
        add(s["message_key"], s["slots"], s["mode"])
    # In-task lines of the real demo scenario (exported by make export-scenario), via the JS replay engine.
    real = ROOT / "contracts" / "examples" / "demo_scenario.json"
    if real.exists():
        for e in demo_cli.run_replay(json.loads(real.read_text(encoding="utf-8"))):
            for s in e["saathi"]:
                add(s["message_key"], s["slots"], s["mode"])
    for key, t in demo_cli.T["templates"].items():
        if "{" in json.dumps(t["en"], ensure_ascii=False):
            continue
        add(key, {}, default_mode(key))
    for key, slots in FIXED_SLOT_LINES:
        add(key, slots, default_mode(key))
    if extras:
        added = 0
        for key, slots, mode in proximity_lines() + debrief_over_lines():
            new = {k: v for k, v in phrasings(key, slots, mode).items() if k not in lines}
            if added + len(new) > EXTRA_CLIP_CAP:
                break
            lines.update(new)
            added += len(new)
    return sorted(lines.items())


def collect_entries(extras=True):
    """Manifest entries {message_key, lang, mode, text, slots, variant, file}."""
    return [{"message_key": key, "lang": lang, "mode": mode, "text": text, "slots": slots, "variant": variant,
             "file": file_for(lang, mode, text)}
            for (key, lang, mode, text), (slots, variant) in collect_lines(extras)]


def file_for(lang, mode, text):
    p = prosody(mode)
    digest = hashlib.sha1(f"{VOICES[lang]}|{p['rate']}|{p['pitch']}|{p['volume']}|{text}".encode("utf-8")).hexdigest()[:16]
    return f"audio/{lang}/{digest}.mp3"


async def synth(sem, lang, mode, text, path):
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, VOICES[lang], **prosody(mode)).save(str(path))
                return
            except Exception as exc:  # network hiccups: retry, then fail loudly
                if attempt == 2:
                    raise RuntimeError(f"edge-tts failed for {lang} '{text[:40]}': {exc}") from exc
                await asyncio.sleep(1 + attempt)


async def main():
    demo_cli.T = demo_cli.load_templates()
    entries = collect_entries()
    jobs = []
    sem = asyncio.Semaphore(CONCURRENCY)
    for e in entries:
        path = ROOT / "frontend" / "public" / e["file"]
        path.parent.mkdir(parents=True, exist_ok=True)
        if not (path.exists() and path.stat().st_size > 0):   # an empty file is a failed download
            jobs.append(synth(sem, e["lang"], e["mode"], e["text"], path))
    print(f"{len(entries)} lines, {len(jobs)} to synthesize")
    await asyncio.gather(*jobs)

    keep = {e["file"] for e in entries}
    stale = [old for old in AUDIO_DIR.glob("*/*.mp3") if f"audio/{old.parent.name}/{old.name}" not in keep]
    for old in stale:
        old.unlink()
    manifest = {"voices": VOICES, "entries": entries}
    (AUDIO_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    size_mb = sum((AUDIO_DIR.parent / e["file"]).stat().st_size for e in entries) / 1e6
    by_key = collections.Counter(e["message_key"] for e in entries)
    print(f"wrote frontend/public/audio/manifest.json ({len(entries)} entries, {len(stale)} stale MP3s removed)")
    print(f"  off-script extras: proximity_alert {by_key['proximity_alert']} clips, "
          f"debrief_over {by_key['debrief_over']} clips (cap {EXTRA_CLIP_CAP} added)")
    print(f"  manifest: {len(entries)} clips, {size_mb:.1f} MB of MP3")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())
