"""The committed audio manifest must cover every demo line; mode mapping must mirror modes.js.

Offline: no edge-tts calls. If a template, the demo or modes.js changes, run `make audio`.
"""
import json
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import demo_cli  # noqa: E402
import generate_audio as ga  # noqa: E402

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
TEMPLATES = ROOT / "scripts" / "out" / "templates.json"


def _manifest():
    return json.loads((ga.AUDIO_DIR / "manifest.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def templates():
    if not TEMPLATES.exists():
        if shutil.which("node") is None:
            pytest.skip("node not installed and templates.json not exported")
        import subprocess
        subprocess.run(["node", str(ROOT / "scripts" / "export_templates.mjs")], cwd=ROOT, check=True)
    demo_cli.T = demo_cli.load_templates()
    return demo_cli.T


def test_prosody_mirrors_modes_js(templates):
    assert ga.prosody("alert") == {"rate": "+15%", "pitch": "+30Hz", "volume": "+0%"}
    assert ga.prosody("care") == {"rate": "-15%", "pitch": "-10Hz", "volume": "-20%"}
    assert ga.prosody("friendly") == {"rate": "+0%", "pitch": "+0Hz", "volume": "-10%"}
    assert ga.prosody("unknown") == ga.prosody("friendly")


def test_default_mode():
    assert ga.default_mode("belt_before_move") == "alert"
    assert ga.default_mode("warn.heat") == "alert"
    assert ga.default_mode("break_time") == "care"
    assert ga.default_mode("debrief_over") == "debrief"
    assert ga.default_mode("greeting") == "friendly"


def test_manifest_files_exist(templates):
    entries = _manifest()["entries"]
    assert entries
    for e in entries:
        assert set(e) == {"message_key", "lang", "mode", "text", "slots", "variant", "file"}
        assert e["file"] == ga.file_for(e["lang"], e["mode"], e["text"])
        assert (ga.AUDIO_DIR.parent / e["file"]).stat().st_size > 1000


@needs_node
def test_manifest_is_up_to_date_with_demo_and_templates(templates):
    expected = [k for k, _ in ga.collect_lines()]
    have = {(e["message_key"], e["lang"], e["mode"], e["text"]) for e in _manifest()["entries"]}
    missing = [k for k in expected if k not in have]
    assert not missing, f"{len(missing)} lines not pre-rendered - run `make audio`: {missing[:3]}"
    keys = {(k[0], k[1]) for k in expected}
    for key in ["belt_before_move", "proximity_alert", "greeting", "shift_hello", "break_time",
                "cmd_quiet_on", "cmd_quiet_off", "debrief_over"]:
        assert (key, "en") in keys and (key, "hi") in keys, key
