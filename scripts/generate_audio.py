"""Pre-generate Saathi's voice lines as MP3 (offline playback) with edge-tts neural voices.

Lines rendered:
  - every line Saathi says in the headless demo (scripts/demo_cli.py, same template rendering), and
  - every phrasing (variant) of each of those lines, and
  - every fixed line (templates without slots: safety alerts, belt-before-you-move, breaks,
    lessons, quiet-mode confirmations ...),
in English (en-IN) and Hindi (hi-IN). Each voice mode's pitch/rate/volume from modes.js is mapped
to edge-tts prosody parameters.

Output: frontend/public/audio/{lang}/{hash}.mp3 and frontend/public/audio/manifest.json.
Files are named by a hash of (voice, prosody, text), so unchanged lines are not re-downloaded and
stale files are removed. Needs network access. Run: make audio
"""
import asyncio
import hashlib
import json
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

# Mode used for fixed (slot-free) lines; matches what the replay rules / demo use for these keys.
ALERT_KEYS = {"belt_before_move", "seatbelt_unfastened", "safety_alert", "proximity_alert"}
CARE_KEYS = {"break_time", "care_break"}


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


def collect_lines():
    """Unique ((message_key, lang, mode, text), (slots, variant)) pairs: demo lines + fixed lines, all phrasings."""
    spoken = demo_cli.main(echo=False)
    lines = {}

    def add(key, slots, mode):
        # every phrasing, so whichever variant the app picks has an MP3
        for v in range(demo_cli.variant_count(key)):
            for lang in LANGS:
                lines[(key, lang, mode, demo_cli.render(key, slots, lang, v))] = (slots, v)

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
    return sorted(lines.items())


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
    lines = collect_lines()
    entries, jobs = [], []
    sem = asyncio.Semaphore(CONCURRENCY)
    for (key, lang, mode, text), (slots, variant) in lines:
        rel = file_for(lang, mode, text)
        path = ROOT / "frontend" / "public" / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        entries.append({"message_key": key, "lang": lang, "mode": mode, "text": text, "slots": slots, "variant": variant, "file": rel})
        if not path.exists():
            jobs.append(synth(sem, lang, mode, text, path))
    print(f"{len(entries)} lines, {len(jobs)} to synthesize")
    await asyncio.gather(*jobs)

    keep = {e["file"] for e in entries}
    for old in AUDIO_DIR.glob("*/*.mp3"):
        if f"audio/{old.parent.name}/{old.name}" not in keep:
            old.unlink()
    manifest = {"voices": VOICES, "entries": entries}
    (AUDIO_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote frontend/public/audio/manifest.json ({len(entries)} entries)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())
