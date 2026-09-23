"""The only place the API touches intel code (data_gen / ml / planner).

Switches between stand-ins and the real modules via config.USE_STANDINS (read at call time).
"""
import importlib

from backend.api import config


def _src(package):
    if config.USE_STANDINS:
        from backend.api import standins
        return standins
    return importlib.import_module(f"backend.{package}")


def load_given_tasks():
    return _src("data_gen").load_given_tasks()


def load_given_usage():
    return _src("data_gen").load_given_usage()


def generate_all(seed=42):
    return _src("data_gen").generate_all(seed=seed)


def todays_tasks():
    return _src("data_gen").todays_tasks()


def todays_weather():
    return _src("data_gen").todays_weather()


def scenario(name):
    return _src("data_gen").scenario(name)


def train_all():
    return _src("ml").train_all()


def predict(task):
    return _src("ml").predict(task)


def debrief(task, windows):
    return _src("ml").debrief(task, windows)


def findings(windows):
    return _src("ml").findings(windows)


def day_plan(tasks, weather):
    return _src("planner").day_plan(tasks, weather)


def operator_history(operator_id):
    return _src("ml").operator_history(operator_id)
