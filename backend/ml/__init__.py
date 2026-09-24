"""M2 ML: task time estimator, counterfactual debrief and behaviour findings."""
from .drift import fatigue_drift, train_drift
from .estimator import MIN_ATTRIBUTION_OVERRUN_MIN, debrief, debrief_lines, finding_lines, predict, train_estimator
from .history import operator_history
from .findings import rule_findings


def train_all() -> None:
    """Train and save every model (generates synthetic data first if it is missing)."""
    train_estimator()
    train_drift()


def findings(windows: list[dict]) -> list[dict]:
    """BehaviorFinding list for the given windows, oldest first (fatigue_drift uses the
    IsolationForest when trained, else its rule fallback)."""
    return sorted(rule_findings(windows) + fatigue_drift(windows), key=lambda f: f["window_timestamp"])


__all__ = ["train_all", "predict", "debrief", "debrief_lines", "finding_lines", "findings", "operator_history",
           "MIN_ATTRIBUTION_OVERRUN_MIN"]
