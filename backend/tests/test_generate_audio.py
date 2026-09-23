"""The committed audio manifest must cover every demo line; mode mapping must mirror modes.js.

Offline: no edge-tts calls. If a template, the demo or modes.js changes, run `make audio`.
"""
import json
import re
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import generate_audio as ga  # noqa: E402

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")


def _manifest():
    return json.loads(ga.MANIFEST.read_text(encoding="utf-8"))


def test_modes_match_modes_js():
    js = (ROOT / "frontend" / "src" / "voice" / "modes.js").read_text(encoding="utf-8")
    for mode, values in ga.MODES.items():
        m = re.search(rf"{mode}: \{{ pitch: ([\d.]+), rate: ([\d.]+), volume: ([\d.]+) \}}", js)
        assert m, mode
        assert tuple(float(x) for x in m.groups()) == (values["pitch"], values["rate"], values["volume"])


def test_edge_params():
    assert ga.edge_params("alert") == {"rate": "+15%", "volume": "+0%", "pitch": "+15Hz"}
    assert ga.edge_params("care") == {"rate": "-15%", "volume": "-20%", "pitch": "-5Hz"}
    assert ga.edge_params("friendly") == {"rate": "+0%", "volume": "-10%", "pitch": "+0Hz"}
    assert ga.edge_params("unknown") == ga.edge_params("friendly")


def test_manifest_files_exist():
    entries = _manifest()["entries"]
    assert entries
    for e in entries:
        assert set(e) == {"message_key", "lang", "mode", "text", "file"}
        assert e["file"] == ga.file_for(e["lang"], e["mode"], e["text"])
        assert (ga.AUDIO_DIR.parent / e["file"]).stat().st_size > 1000


@needs_node
def test_manifest_is_up_to_date_with_demo_and_templates():
    expected = ga.collect_entries()
    have = {(e["message_key"], e["lang"], e["mode"], e["text"]) for e in _manifest()["entries"]}
    missing = [e for e in expected if (e["message_key"], e["lang"], e["mode"], e["text"]) not in have]
    assert not missing, f"{len(missing)} lines not pre-rendered - run `make audio`: {missing[:3]}"
    keys = {(e["message_key"], e["lang"]) for e in expected}
    for key in ["belt_before_move", "proximity_alert", "greeting", "shift_hello", "break_time",
                "cmd_quiet_on", "cmd_quiet_off", "debrief_over"]:
        assert (key, "en") in keys and (key, "hi") in keys, key
