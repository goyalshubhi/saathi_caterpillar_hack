"""SQLite stores for incidents and machine memory notes.

Neither table has an operator_id column: behaviour data about a person never lands here.
"""
import json
import sqlite3
from datetime import datetime, timedelta

from backend.api.config import MEMORY_TTL_HOURS

SCHEMA = """
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    category TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    message_key TEXT NOT NULL,
    slots TEXT NOT NULL DEFAULT '{}'
);
"""


def _iso(dt):
    return dt.replace(microsecond=0).isoformat()


class Store:
    def __init__(self, db_path, now=datetime.now):
        self.db_path = db_path
        self.now = now
        with self._conn() as c:
            c.executescript(SCHEMA)

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def reset(self):
        with self._conn() as c:
            c.execute("DELETE FROM incidents")
            c.execute("DELETE FROM memory_notes")

    # incidents
    def add_incident(self, machine_id, category, note, source, timestamp=None):
        ts = timestamp or _iso(self.now())
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO incidents (machine_id, timestamp, category, note, source) VALUES (?, ?, ?, ?, ?)",
                (machine_id, ts, category, note, source))
            incident_id = cur.lastrowid
        self.add_note(machine_id, "memory_incident", {"category": category})
        return self.get_incident(incident_id)

    def get_incident(self, incident_id):
        with self._conn() as c:
            row = c.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        return dict(row) if row else None

    def list_incidents(self, machine_id=None):
        sql, args = "SELECT * FROM incidents", ()
        if machine_id:
            sql, args = sql + " WHERE machine_id = ?", (machine_id,)
        with self._conn() as c:
            rows = c.execute(sql + " ORDER BY id", args).fetchall()
        return [dict(r) for r in rows]

    # memory notes
    def add_note(self, machine_id, message_key, slots):
        created = self.now()
        expires = created + timedelta(hours=MEMORY_TTL_HOURS)
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO memory_notes (machine_id, created_at, expires_at, message_key, slots) VALUES (?, ?, ?, ?, ?)",
                (machine_id, _iso(created), _iso(expires), message_key, json.dumps(slots, ensure_ascii=False)))
            note_id = cur.lastrowid
            row = c.execute("SELECT * FROM memory_notes WHERE id = ?", (note_id,)).fetchone()
        return _note(row)

    def list_notes(self, machine_id):
        with self._conn() as c:
            rows = c.execute(
                "SELECT * FROM memory_notes WHERE machine_id = ? AND expires_at > ? ORDER BY id",
                (machine_id, _iso(self.now()))).fetchall()
        return [_note(r) for r in rows]


def _note(row):
    note = dict(row)
    note["slots"] = json.loads(note["slots"])
    return note
