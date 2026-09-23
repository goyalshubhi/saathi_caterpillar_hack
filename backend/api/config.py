"""Runtime settings for the API. One flag switches intel between stand-ins and real modules."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT_EXAMPLES = ROOT / "contracts" / "examples"

# True: use backend/api/standins.py (fixture data). False: use backend.data_gen / ml / planner.
USE_STANDINS = os.getenv("SAATHI_USE_STANDINS", "1") == "1"

DB_PATH = os.getenv("SAATHI_DB", str(ROOT / "backend" / "api" / "saathi.db"))

MEMORY_TTL_HOURS = 48
CORS_ORIGINS = ["http://localhost:5173"]
