"""Export the real "demo" scenario, as served by GET /telemetry/scenario/demo, to
contracts/examples/demo_scenario.json. The JS replay integration test reads this file.

Run: make export-scenario   (uses the real intel modules)
"""
import json
import os
import sys
import tempfile
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["SAATHI_USE_STANDINS"] = "0"
warnings.filterwarnings("ignore", message="Using `httpx`")

from fastapi.testclient import TestClient  # noqa: E402

from backend.api.main import create_app  # noqa: E402

with tempfile.TemporaryDirectory() as tmp:
    with TestClient(create_app(db_path=str(Path(tmp) / "export.db"), train=False)) as api:
        resp = api.get("/telemetry/scenario/demo")
        resp.raise_for_status()
        scenario = resp.json()

out = ROOT / "contracts" / "examples" / "demo_scenario.json"
out.write_text(json.dumps(scenario, indent=2) + "\n", encoding="utf-8")
print(f"wrote {out.relative_to(ROOT)} ({len(scenario['windows'])} windows, task {scenario['task_id']})")
