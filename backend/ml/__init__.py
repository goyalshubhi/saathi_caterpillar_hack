"""M2 ML: task time estimator, counterfactual debrief and behaviour findings."""
from .estimator import debrief, predict, train_estimator
from .findings import rule_findings


def train_all() -> None:
    """Train and save every model (generates synthetic data first if it is missing)."""
    train_estimator()


def findings(windows: list[dict]) -> list[dict]:
    """BehaviorFinding list for the given windows, oldest first."""
    return rule_findings(windows)


__all__ = ["train_all", "predict", "debrief", "findings"]
