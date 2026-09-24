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

// Machine Memory notes as shown and spoken. The API stores one note per logged incident, so the same
// incident logged twice gives identical notes (same message_key + slots): they collapse into one,
// keeping the newest. Newest first.
const slotKey = (slots = {}) => JSON.stringify(Object.keys(slots).sort().map((k) => [k, slots[k]]));
const newer = (a, b) => (a.created_at === b.created_at ? a.id > b.id : a.created_at > b.created_at);
export function distinctNotes(memory = []) {
  const byKey = new Map();
  for (const n of memory) {
    const key = `${n.message_key}|${slotKey(n.slots)}`;
    if (!byKey.has(key) || newer(n, byKey.get(key))) byKey.set(key, n);
  }
  return [...byKey.values()].sort((a, b) => (newer(a, b) ? -1 : 1));
}

export function morningEvents({ tasks, weather, plan, predictions = {}, memory = [], machine }) {
  const out = [ev('shift_hello', { machine_id: machine })];
  // Only the first (newest) note is spoken; the card lists every distinct note.
  const [note] = distinctNotes(memory);
  if (note) out.push(ev(note.message_key, note.slots, 'safety', 'alert'));
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

// The overrun against the CAT estimate, split as the debrief contract defines it.
export function debriefSplit(d) {
  const uncontrollable = Math.max(0, mins(d.uncontrollable_min));
  const controllable = Math.max(0, mins(d.controllable_min));
  return { over: uncontrollable + controllable, uncontrollable, controllable };
}

export function topFactorNames(d, n = 2) {
  return [...(d.top_factors ?? [])].filter((f) => f.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, n).map((f) => f.name);
}

export function debriefEvents(d, findings = []) {
  const { over, uncontrollable, controllable } = debriefSplit(d);
  const out = [];
  if (over > 0) {
    out.push(ev('debrief_over', { over_min: over, uncontrollable_min: uncontrollable, controllable_min: controllable, factors: topFactorNames(d) }, 'info', 'debrief'));
    if (uncontrollable >= controllable) out.push(ev('debrief_not_your_fault', {}, 'info', 'debrief'));
  } else {
    out.push(ev('debrief_on_time', {}, 'info', 'debrief'));
  }
  findings.slice(0, 4).forEach((f) => out.push(ev(f.message_key, f.slots, 'info', 'debrief')));
  return out;
}
