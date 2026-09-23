// Pure builders: API data (contract shapes) -> the ordered SaathiEvents each screen speaks.
// Mirrors scripts/demo_cli.py so the UI says what the headless demo says.

const ev = (message_key, slots = {}, priority = 'info', mode = 'friendly') => ({ priority, mode, message_key, slots });
const mins = (x) => Math.round(x);

export function maxTemp(weather) {
  return weather?.length ? Math.max(...weather.map((h) => h.temperature_c)) : null;
}

export function rainyMorning(weather) {
  return Boolean(weather?.some((h) => h.rain && h.hour <= 10));
}

export function orderedTasks(tasks, plan) {
  if (!tasks) return [];
  const byId = Object.fromEntries(tasks.map((t) => [t.task_id, t]));
  const order = plan?.tasks_ordered ?? tasks.map((t) => t.task_id);
  return order.map((id) => byId[id]).filter(Boolean);
}

export function morningEvents({ tasks, weather, plan, predictions = {}, memory = [], machine }) {
  const out = [ev('shift_hello', { machine_id: machine })];
  memory.forEach((n) => out.push(ev(n.message_key, n.slots, 'safety', 'alert')));
  out.push(ev('greeting', { count: tasks.length }));
  orderedTasks(tasks, plan).forEach((t, i) => {
    const p = predictions[t.task_id];
    out.push(ev('task_card', { n: i + 1, task_type: t.task_type, predicted_min: mins(p ? p.predicted_min : t.estimated_time_min) }));
  });
  if (rainyMorning(weather)) out.push(ev('rain_today'));
  const hot = maxTemp(weather);
  if (hot !== null && hot >= 33) out.push(ev('heat_today', { max_temp: mins(hot) }, 'care', 'care'));
  out.push(ev('plan_order', { order: orderedTasks(tasks, plan).map((t) => t.task_type) }));
  if (plan?.breaks?.length) out.push(ev('breaks_planned', { hours: plan.breaks.map((b) => b.hour) }));
  return out;
}

export function warningsFor(plan, taskId) {
  return (plan?.condition_warnings ?? []).filter((w) => w.task_id === taskId);
}

export function pretaskEvents({ task, prediction, plan }) {
  return [
    ev('pretask_estimate', {
      task_type: task.task_type, weather: task.weather,
      cat_min: mins(prediction.cat_estimate_min), predicted_min: mins(prediction.predicted_min),
    }),
    ...warningsFor(plan, task.task_id).map((w) => ev(w.message_key, w.slots, 'safety', 'alert')),
  ];
}

// The raw model split (Stage View "Model outputs"); the Debrief screen shows the backend's lines instead.
export function debriefSplit(d) {
  const uncontrollable = Math.max(0, mins(d.uncontrollable_min));
  const controllable = Math.max(0, mins(d.controllable_min));
  return { over: uncontrollable + controllable, uncontrollable, controllable };
}

// The debrief lines are the backend's (POST /debrief -> lines, from backend.ml.debrief_lines), spoken
// as given: whether to attribute the overrun, and the first-shift wording, are decided there.
export const ATTRIBUTED_KEYS = ['debrief_over', 'debrief_over_first_shift'];

export function debriefHeadline(d) {
  return d?.lines?.[0] ?? null;
}

export function debriefEvents(d, findings = []) {
  return [...(d.lines ?? []), ...findings.slice(0, 4)].map((l) => ev(l.message_key, l.slots, 'info', 'debrief'));
}
