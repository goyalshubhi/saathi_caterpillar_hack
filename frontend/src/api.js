// Thin fetch wrapper around the Saathi API.
//
// LIVE mode talks to http://localhost:8000. If the API is unreachable the app switches to FIXTURE mode:
// every call answers from contracts/examples (incidents and memory notes kept in memory), and the top
// bar shows an "offline data" badge. Model outputs are also logged for the Stage View.
import { fixture } from './fixtures.js';
import { store, addLog, markArch, MACHINE_ID } from './state/store.js';

export const API_BASE = 'http://localhost:8000';
const TIMEOUT_MS = 2500;

let mode = 'unknown'; // unknown | live | fixture
let detecting = null;
let standins = true; // /health says whether the API still serves intel stand-ins

function setMode(m) {
  mode = m;
  if (store.get().apiMode !== m) store.set({ apiMode: m });
}

export function forceMode(m) {
  detecting = null;
  setMode(m);
}

export async function detectMode() {
  if (mode !== 'unknown') return mode;
  detecting ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) standins = Boolean((await res.json()).standins);
      setMode(res.ok ? 'live' : 'fixture');
    } catch {
      setMode('fixture');
    }
    return mode;
  })();
  return detecting;
}

class HttpError extends Error {
  constructor(status, text) {
    super(`HTTP ${status}: ${text}`);
    this.status = status;
  }
}

async function http(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS * 4),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  return res.json();
}

// Call the live API; on a network failure fall back to the fixture answer for the rest of the session.
async function call(method, path, body, offline) {
  if ((await detectMode()) === 'live') {
    try {
      return await http(method, path, body);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      setMode('fixture');
    }
  }
  return offline();
}

// ---------- fixture-mode state ----------
let offlineIncidents = [];
let offlineNotes = [];
const nowIso = () => new Date().toISOString().slice(0, 19);
const plus48h = (iso) => new Date(new Date(`${iso}Z`).getTime() + 48 * 3600e3).toISOString().slice(0, 19);

function offlinePredict(task) {
  if (task.task_id === 'T101') return fixture('prediction');
  const extra = Math.round(task.estimated_time_min * 0.1);
  return {
    task_id: task.task_id, cat_estimate_min: task.estimated_time_min, predicted_min: task.estimated_time_min + extra,
    uncontrollable_min: extra, controllable_min: 0, top_factors: [{ name: 'temperature', minutes: extra }],
  };
}

// ---------- endpoints ----------
export async function getTasks() {
  markArch('telemetry');
  return call('GET', '/tasks/today', null, () => fixture('tasksToday'));
}

export async function getWeather() {
  return call('GET', '/weather/today', null, () => fixture('weatherToday'));
}

export async function getPlan() {
  markArch('planner');
  const plan = await call('GET', '/plan/today', null, () => fixture('dayPlan'));
  addLog('model', { kind: 'plan', data: plan });
  return plan;
}

export async function getPrediction(taskId) {
  markArch('models');
  const pred = await call('GET', `/predict/${taskId}`, null, () => {
    const task = fixture('tasksToday').find((t) => t.task_id === taskId);
    return offlinePredict(task ?? { task_id: taskId, estimated_time_min: 0 });
  });
  addLog('model', { kind: 'prediction', data: pred });
  return pred;
}

// What-if needs a prediction for an edited task: POST /predict (body = Task). The API's OpenAPI
// document tells us whether it exists, so we never fire a request that would 404.
let whatIfSupport = null;
export async function supportsWhatIf() {
  if ((await detectMode()) !== 'live') return false;
  whatIfSupport ??= http('GET', '/openapi.json').then((doc) => Boolean(doc.paths?.['/predict']?.post)).catch(() => false);
  return whatIfSupport;
}

export async function predictTask(task) {
  if (!(await supportsWhatIf())) return null;
  try {
    markArch('models');
    const pred = await http('POST', '/predict', task);
    addLog('model', { kind: 'prediction', data: pred, whatIf: true });
    return pred;
  } catch {
    return null;
  }
}

// The answer carries `lines`, the backend's debrief wording (attribution only from 3 min over; the
// first-shift variant when this operator has no history). operator_id is read there, never stored.
export async function postDebrief(taskId, windows, operatorId) {
  markArch('models');
  const d = await call('POST', '/debrief', { task_id: taskId, windows, operator_id: operatorId },
    () => ({ ...fixture('debrief'), task_id: taskId }));
  addLog('model', { kind: 'debrief', data: d });
  return d;
}

export async function getScenario(name) {
  markArch('replay');
  try {
    return await call('GET', `/telemetry/scenario/${name}`, null, () => {
      if (name !== 'demo') throw new HttpError(404, `unknown scenario ${name}`);
      return fixture('scenarioDemo');
    });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
}

// Stand-ins (and fixtures) only have the "demo" scenario; the real intel modules add "fatigue".
export async function hasScenario(name) {
  if (name === 'demo') return true;
  return (await detectMode()) === 'live' && !standins;
}

export async function analyze(windows) {
  markArch('models');
  const f = await call('POST', '/behavior/analyze', { windows }, () => (windows.length ? fixture('findings') : []));
  addLog('model', { kind: 'findings', data: f });
  return f;
}

export async function getIncidents(machineId = MACHINE_ID) {
  return call('GET', `/incidents?machine_id=${encodeURIComponent(machineId)}`, null,
    () => offlineIncidents.filter((i) => i.machine_id === machineId));
}

// Never sends operator_id: incidents belong to the machine.
export async function postIncident({ category, source = 'tap', note = '', machineId = MACHINE_ID }) {
  return call('POST', '/incidents', { machine_id: machineId, category, source, note }, () => {
    const inc = { id: offlineIncidents.length + 1, machine_id: machineId, timestamp: nowIso(), category, note, source };
    offlineIncidents = [...offlineIncidents, inc];
    const created = inc.timestamp;
    offlineNotes = [...offlineNotes, {
      id: offlineNotes.length + 1, machine_id: machineId, created_at: created, expires_at: plus48h(created),
      message_key: 'memory_incident', slots: { category },
    }];
    return inc;
  });
}

const OFFLINE_WORDS = {
  person_in_zone: ['person', 'people', 'man', 'worker', 'someone', 'आदमी', 'व्यक्ति', 'कोई'],
  near_miss: ['near miss', 'almost', 'nearly', 'close call', 'बाल बाल', 'बाल-बाल'],
  machine_issue: ['leak', 'oil', 'brake', 'engine', 'noise', 'smoke', 'broken', 'तेल', 'ब्रेक', 'इंजन', 'खराब'],
};

export async function classifyIncident(text) {
  return call('POST', '/incidents/classify', { text }, () => {
    const t = text.toLowerCase();
    for (const [category, words] of Object.entries(OFFLINE_WORDS)) {
      const matched = words.filter((w) => t.includes(w));
      if (matched.length) return { category, matched };
    }
    return { category: 'other', matched: [] };
  });
}

export async function getMemory(machineId = MACHINE_ID) {
  return call('GET', `/memory/${machineId}`, null, () => offlineNotes.filter((n) => n.machine_id === machineId));
}

export async function reset() {
  offlineIncidents = [];
  offlineNotes = [];
  return call('POST', '/reset', {}, () => ({ ok: true }));
}
