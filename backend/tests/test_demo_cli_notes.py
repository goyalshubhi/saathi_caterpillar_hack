"""The headless demo speaks Machine Memory notes like the UI (frontend/src/saathi/briefings.js
distinctNotes): identical notes collapse into the newest, newest first, only the first is spoken."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from demo_cli import distinct_notes  # noqa: E402


def _note(id_, category, created_at):
    return {"id": id_, "machine_id": "EXC001", "created_at": created_at, "expires_at": "2026-09-26T08:00:00",
            "message_key": "memory_incident", "slots": {"category": category}}


def test_identical_notes_collapse_to_the_newest_newest_first():
    zone1 = _note(1, "person_in_zone", "2026-09-24T07:10:00")
    zone2 = _note(2, "person_in_zone", "2026-09-24T07:20:00")
    near_miss = _note(3, "near_miss", "2026-09-24T07:15:00")
    assert [n["id"] for n in distinct_notes([zone1, zone2, near_miss])] == [2, 3]
    assert distinct_notes([]) == []
