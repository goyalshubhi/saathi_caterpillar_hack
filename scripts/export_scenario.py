"""Export the real "demo" scenario from backend.data_gen to contracts/examples/demo_scenario.json.

The JS replay integration test reads this file. Run: make export-scenario
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("SAATHI_USE_STANDINS", "0")

from backend.api import intel  # noqa: E402

out = ROOT / "contracts" / "examples" / "demo_scenario.json"
out.write_text(json.dumps(intel.scenario("demo"), indent=2) + "\n", encoding="utf-8")
print(f"wrote {out.relative_to(ROOT)}")
