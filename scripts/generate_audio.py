"""Pre-render Saathi's lines to MP3 with edge-tts, so the demo speaks without a network or OS voices.

Lines rendered (en + hi):
  - every line the headless demo says (scripts/demo_cli.py is run with say() intercepted, so the
    text is exactly what templates.js renders for the demo), and
  - fixed lines: every template without slots (safety alerts, belt-before-you-move, breaks,
    lessons, quiet-mode and other command confirmations, debrief lines) plus greetings,
    memory notes and incident confirmations for every machine / incident category, and
  - off-script extras, capped at EXTRA_CLIP_CAP clips: proximity_alert at every whole-metre
    distance of an alert window in the synthetic telemetry or scripted scenarios, then the most
    frequent debrief_over lines from debrief() over every synthetic task (demo shift windows).

Output: frontend/public/audio/{lang}/{hash}.mp3 and frontend/public/audio/manifest.json.
Existing MP3s are reused; files no longer in the manifest are deleted.

Run: make audio   (needs internet and `pip install -r requirements-dev.txt`)
"""
import asyncio
import collections
import contextlib
import hashlib
import json
import math
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

AUDIO_DIR = ROOT / "frontend" / "public" / "audio"
MANIFEST = AUDIO_DIR / "manifest.json"
LANGS = ["en", "hi"]
VOICES = {"en": "en-IN-PrabhatNeural", "hi": "hi-IN-MadhurNeural"}

# Same values as frontend/src/voice/modes.js (checked by backend/tests/test_generate_audio.py).
MODES = {
    "friendly": {"pitch": 1.0, "rate": 1.0, "volume": 0.9},
    "alert": {"pitch": 1.3, "rate": 1.15, "volume": 1.0},
    "care": {"pitch": 0.9, "rate": 0.85, "volume": 0.8},
    "debrief": {"pitch": 1.0, "rate": 1.0, "volume": 0.9},
}
PITCH_HZ_PER_UNIT = 50      # Web Speech pitch 1.3 -> +15Hz on the neural voice
EXTRA_CLIP_CAP = 150        # off-script extras (en + hi clips) so `make audio` stays small and fast

# Mode for fixed lines (demo lines keep the mode the demo uses).
FIXED_MODES = {
    "belt_before_move": "alert", "seatbelt_unfastened": "alert", "proximity_alert": "alert",
    "safety_alert": "alert", "memory_incident": "alert",
    "break_time": "care", "care_break": "care", "finding.fatigue_drift": "care",
    "debrief_on_time": "debrief", "debrief_near_time": "debrief", "debrief_not_your_fault": "debrief",
}
MACHINES = ["EXC001", "EXC002"]
CATEGORIES = ["near_miss", "person_in_zone", "machine_issue", "other"]
FIXED_SLOT_LINES = (
    [("shift_hello", {"machine_id": m}) for m in MACHINES]
    + [("memory_incident", {"category": c}) for c in CATEGORIES]
    + [("incident_logged", {"category": c}) for c in CATEGORIES]
    + [("debrief_near_time", {"over_min": m}) for m in (1, 2)]   # below the attribution threshold
)


def edge_params(mode):
    """modes.js pitch/rate/volume (Web Speech scale, 1.0 = default) -> edge-tts strings."""
    m = MODES.get(mode, MODES["friendly"])
    return {
        "rate": f"{round((m['rate'] - 1) * 100):+d}%",
        "volume": f"{round((m['volume'] - 1) * 100):+d}%",
        "pitch": f"{round((m['pitch'] - 1) * PITCH_HZ_PER_UNIT):+d}Hz",
    }


def file_for(lang, mode, text):
    digest = hashlib.sha1(f"{VOICES[lang]}|{mode}|{text}".encode("utf-8")).hexdigest()[:16]
    return f"audio/{lang}/{digest}.mp3"


def demo_lines():
    """(message_key, slots, mode) for every say() in the headless demo, in order."""
    import demo_cli
    lines = []
    real_say = demo_cli.say
    demo_cli.say = lambda key, slots=None, mode="friendly", priority="info": lines.append((key, slots or {}, mode))
    try:
        with open(os.devnull, "w", encoding="utf-8") as devnull, contextlib.redirect_stdout(devnull):
            demo_cli.main()
    finally:
        demo_cli.say = real_say
    return lines


def spoken_distance(m):
    """Mirror of spokenDistance() in frontend/src/replay/rules.js: whole metres, rounded down, >= 1."""
    return max(1, math.floor(m))


def proximity_lines():
    """proximity_alert at every whole-metre distance an alert window can produce."""
    sys.path.insert(0, str(ROOT))
    import pandas as pd
    from backend.data_gen import scenario
    from backend.data_gen.generator import SYNTHETIC_DIR
    windows = pd.read_csv(SYNTHETIC_DIR / "telemetry.csv").to_dict(orient="records")
    windows += scenario("demo") + scenario("clean")
    metres = sorted({spoken_distance(w["proximity_distance_m"]) for w in windows
                     if w["safety_alert_triggered"] == "Yes" and w["proximity_distance_m"] is not None})
    return [("proximity_alert", {"distance_m": m}, "alert") for m in metres]


def debrief_over_lines():
    """debrief_over lines from debrief() over every synthetic task, most frequent first."""
    sys.path.insert(0, str(ROOT))
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


def collect_entries(extras=True):
    """Unique manifest entries {message_key, lang, mode, text, file}. Extras come last, capped."""
    subprocess.run(["node", str(ROOT / "scripts" / "export_templates.mjs")], check=True, capture_output=True)
    import demo_cli
    lines = demo_lines()
    templates = demo_cli.T["templates"]
    for key, tpl in templates.items():
        if "{" not in tpl["en"]:
            lines.append((key, {}, FIXED_MODES.get(key, "friendly")))
    lines += [(key, slots, FIXED_MODES.get(key, "friendly")) for key, slots in FIXED_SLOT_LINES]

    entries, seen = [], set()

    def add(key, slots, mode):
        new = []
        for lang in LANGS:
            text = demo_cli.render(key, slots, lang)
            if (key, lang, mode, text) not in seen:
                seen.add((key, lang, mode, text))
                new.append({"message_key": key, "lang": lang, "mode": mode, "text": text,
                            "file": file_for(lang, mode, text)})
        return new

    for line in lines:
        entries += add(*line)
    if extras:
        added = 0
        for line in proximity_lines() + debrief_over_lines():
            new = add(*line)
            if added + len(new) > EXTRA_CLIP_CAP:
                break
            entries += new
            added += len(new)
    return entries


async def synthesize(entries, concurrency=4):
    import edge_tts
    sem = asyncio.Semaphore(concurrency)

    async def one(entry):
        path = AUDIO_DIR.parent / entry["file"]
        if path.exists() and path.stat().st_size > 0:
            return False
        path.parent.mkdir(parents=True, exist_ok=True)
        async with sem:
            tmp = path.with_suffix(".part")
            await edge_tts.Communicate(entry["text"], VOICES[entry["lang"]], **edge_params(entry["mode"])).save(str(tmp))
            tmp.replace(path)
        return True

    results = await asyncio.gather(*(one(e) for e in entries))
    return sum(results)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    entries = collect_entries()
    made = asyncio.run(synthesize(entries))
    keep = {AUDIO_DIR.parent / e["file"] for e in entries}
    stale = [p for p in AUDIO_DIR.glob("*/*.mp3") if p not in keep]
    for p in stale:
        p.unlink()
    manifest = {
        "note": "Generated by scripts/generate_audio.py (make audio). Lookup by message_key + lang + exact text.",
        "voices": VOICES,
        "entries": entries,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    size_mb = sum((AUDIO_DIR.parent / e["file"]).stat().st_size for e in entries) / 1e6
    by_key = collections.Counter(e["message_key"] for e in entries)
    print(f"{len(entries)} lines ({made} new MP3s, {len(stale)} stale removed) -> {MANIFEST.relative_to(ROOT)}")
    print(f"  off-script extras: proximity_alert {by_key['proximity_alert']} clips, "
          f"debrief_over {by_key['debrief_over']} clips (cap {EXTRA_CLIP_CAP} added)")
    print(f"  manifest: {len(entries)} clips, {size_mb:.1f} MB of MP3")


if __name__ == "__main__":
    main()
