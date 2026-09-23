"""A fresh start (no synthetic data, no trained models on disk) must train the real models at API
startup, so `make dev` never quietly runs the demo on the rule fallback."""
import importlib

import pytest
from fastapi.testclient import TestClient

from backend.api import config
from backend.api.main import create_app
from backend.data_gen import generator, scenario
from backend.ml import drift, estimator


@pytest.fixture
def fresh(tmp_path, monkeypatch):
    """Empty synthetic dir + model paths in tmp, nothing cached in memory, real modules."""
    synthetic = tmp_path / "synthetic"
    for module in (generator, estimator, drift):
        monkeypatch.setattr(module, "SYNTHETIC_DIR", synthetic)
    monkeypatch.setattr(estimator, "MODEL_PATH", tmp_path / "models" / "time_estimator.joblib")
    monkeypatch.setattr(estimator, "MODEL_DIR", tmp_path / "models")
    monkeypatch.setattr(drift, "MODEL_PATH", tmp_path / "models" / "drift_iforest.joblib")
    monkeypatch.setattr(estimator, "_model", None)
    monkeypatch.setattr(drift, "_model", None)
    monkeypatch.setattr(config, "USE_STANDINS", False)
    return tmp_path


def _rule_only_windows():
    """Two seatbelt lapses early in the last hour, then normal work: the rule fallback fires on
    this, the IsolationForest (which needs the latest windows to be anomalous) does not."""
    w = scenario("clean")
    for k in (len(w) - 4, len(w) - 3):
        w[k] = dict(w[k], seatbelt_status="Unfastened", idling_time_min=6)
    return w


def test_real_modules_are_the_default(monkeypatch):
    monkeypatch.delenv("SAATHI_USE_STANDINS", raising=False)
    assert importlib.reload(config).USE_STANDINS is False
    monkeypatch.setenv("SAATHI_USE_STANDINS", "1")                 # stand-ins stay available on request
    assert importlib.reload(config).USE_STANDINS is True
    monkeypatch.delenv("SAATHI_USE_STANDINS")
    importlib.reload(config)


def test_fresh_start_trains_drift_model_before_serving(fresh):
    assert not (fresh / "models").exists() and not (fresh / "synthetic").exists()
    with TestClient(create_app(db_path=str(fresh / "t.db"))) as client:
        # startup generated the data and trained BOTH models
        assert (fresh / "synthetic" / "telemetry.csv").exists()
        assert (fresh / "models" / "time_estimator.joblib").exists()
        assert (fresh / "models" / "drift_iforest.joblib").exists()
        assert drift._get_model() is not None
        assert client.get("/health").json()["standins"] is False

        demo = client.post("/behavior/analyze", json={"windows": scenario("demo")}).json()
        assert any(f["type"] == "fatigue_drift" for f in demo)

        # model-based, not the rule fallback: the rule would flag this, the model does not
        windows = _rule_only_windows()
        assert drift.fatigue_drift(windows, use_model=False)
        found = client.post("/behavior/analyze", json={"windows": windows}).json()
        assert not any(f["type"] == "fatigue_drift" for f in found)
