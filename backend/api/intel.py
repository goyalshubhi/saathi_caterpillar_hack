"""The only place the API touches intel code (data_gen / ml / planner)."""
from backend import data_gen, ml, planner


def load_given_tasks():
    return data_gen.load_given_tasks()


def load_given_usage():
    return data_gen.load_given_usage()


def generate_all(seed=42):
    return data_gen.generate_all(seed=seed)


def todays_tasks():
    return data_gen.todays_tasks()


def todays_weather():
    return data_gen.todays_weather()


def scenario(name):
    return data_gen.scenario(name)


def train_all():
    return ml.train_all()


def predict(task):
    return ml.predict(task)


def debrief(task, windows):
    return ml.debrief(task, windows)


def debrief_lines(prediction, history_available):
    return ml.debrief_lines(prediction, history_available)


def findings(windows):
    return ml.findings(windows)


def day_plan(tasks, weather):
    return planner.day_plan(tasks, weather)


def operator_history(operator_id):
    return ml.operator_history(operator_id)
