"""Runtime settings for the API. One flag switches intel between stand-ins and real modules."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT_EXAMPLES = ROOT / "contracts" / "examples"

# True: use backend/api/standins.py (fixture data). False: use backend.data_gen / ml / planner.
USE_STANDINS = os.getenv("SAATHI_USE_STANDINS", "1") == "1"

DB_PATH = os.getenv("SAATHI_DB", str(ROOT / "backend" / "api" / "saathi.db"))

MEMORY_TTL_HOURS = 48
# Known simplification: full context-aware expiry is future work. Only weather-driven notes get a
# shorter window, because weather hazards (wet ground, wind, heat) go stale well before 48 h.
WEATHER_NOTE_TTL_HOURS = 12
WEATHER_NOTE_KEYS = {"warn.rain_slippery", "warn.rain_trench_edge", "warn.wind_caution", "warn.heat_hydration"}


def note_ttl_hours(message_key):
    return WEATHER_NOTE_TTL_HOURS if message_key in WEATHER_NOTE_KEYS else MEMORY_TTL_HOURS
CORS_ORIGINS = ["http://localhost:5173"]
