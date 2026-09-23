// App actions shared by the screens and the demo controller: fetch from the API into the store.
import * as api from '../api.js';
import { store } from '../state/store.js';
import { say } from './voiceRuntime.js';

export async function loadDay({ force = false } = {}) {
  const s = store.get();
  if (!force && s.tasks && s.plan && s.weather) return s;
  const [tasks, weather, plan] = await Promise.all([api.getTasks(), api.getWeather(), api.getPlan()]);
  const preds = await Promise.all(tasks.map((t) => api.getPrediction(t.task_id)));
  store.set({ tasks, weather, plan, predictions: Object.fromEntries(preds.map((p) => [p.task_id, p])) });
  return store.get();
}

export async function loadMemory() {
  const memory = await api.getMemory(store.get().machine);
  store.set({ memory });
  return memory;
}

export async function loadIncidents() {
  const incidents = await api.getIncidents(store.get().machine);
  store.set({ incidents });
  return incidents;
}

export async function loadScenario() {
  if (store.get().scenario) return store.get().scenario;
  const scenario = await api.getScenario('demo');
  store.set({ scenario });
  return scenario;
}

export async function ensurePrediction(taskId) {
  const have = store.get().predictions[taskId];
  if (have) return have;
  const p = await api.getPrediction(taskId);
  store.set((s) => ({ predictions: { ...s.predictions, [taskId]: p } }));
  return p;
}

// Log an incident for this machine (never with operator_id), confirm it by voice, refresh lists.
export async function logIncident(category, source = 'tap', note = '') {
  const inc = await api.postIncident({ category, source, note, machineId: store.get().machine });
  say({ priority: 'info', mode: 'friendly', message_key: 'incident_logged', slots: { category: inc.category } });
  await Promise.all([loadIncidents(), loadMemory()]);
  return inc;
}

export async function runDebrief(taskId) {
  const scenario = await loadScenario();
  const windows = scenario?.task_id === taskId ? scenario.windows : [];
  const [debrief, findings] = await Promise.all([api.postDebrief(taskId, windows, store.get().operator), api.analyze(windows)]);
  store.set({ debrief, findings });
  return { debrief, findings };
}

// Fatigue drift (P1): analyse the "fatigue" scenario. Returns the finding, or null when the model
// or scenario is not available yet (stand-ins).
export async function checkFatigue() {
  const sc = (await api.hasScenario('fatigue')) ? await api.getScenario('fatigue') : null;
  if (!sc) {
    store.set({ fatigue: false });
    return null;
  }
  const found = (await api.analyze(sc.windows)).find((f) => f.type === 'fatigue_drift') ?? null;
  store.set({ fatigue: found ?? false });
  return found;
}

export function toggleLang() {
  store.set((s) => ({ lang: s.lang === 'en' ? 'hi' : 'en' }));
}

export function toggleTheme() {
  store.set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' }));
}

export function markLessonDone(key) {
  store.set((s) => (s.completedLessons.includes(key) ? {} : { completedLessons: [...s.completedLessons, key] }));
}
