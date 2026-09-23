"""Runtime settings for the API."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT_EXAMPLES = ROOT / "contracts" / "examples"

DB_PATH = os.getenv("SAATHI_DB", str(ROOT / "backend" / "api" / "saathi.db"))

MEMORY_TTL_HOURS = 48
CORS_ORIGINS = ["http://localhost:5173"]
