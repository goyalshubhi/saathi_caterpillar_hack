// Demo mode: plays PLAN.md demo script steps 1–7 automatically, with the deterministic scenario and
// DEMO_SEED phrasing. Pause / resume, previous / next and jump to any step.
//
// Each step navigates the operator app and waits for what it triggers (the screen's spoken briefing,
// the replay, ...) to finish. Jumping cancels the running step (token check) and prepares whatever the
// target step needs (day data, a logged incident for Shift 2, ...).
import { store, patchDemo, addLog } from '../state/store.js';
import * as api from '../api.js';
import { loadDay, loadScenario, loadMemory, logIncident, checkFatigue } from '../saathi/actions.js';
import { resetVoice, clearVoice, setFast, isIdle, sayInOrder } from '../saathi/voiceRuntime.js';
import { startReplay, stopReplay, pauseReplay, resumeReplay, DEMO_SPEED, MAX_SPEED } from '../saathi/replayRuntime.js';

export const DEMO_STEPS = [
  { n: 1, title: 'Morning briefing (Hindi)', short: 'Morning' },
  { n: 2, title: 'Pre-task estimate + rain warning', short: 'Pre-task' },
  { n: 3, title: 'In-task replay: lesson, belt, proximity', short: 'In-task' },
  { n: 4, title: 'Incident: person in zone', short: 'Incident' },
  { n: 5, title: 'Debrief: fair overrun split', short: 'Debrief' },
  { n: 6, title: 'Shift 2 — new operator, same machine', short: 'Shift 2' },
  { n: 7, title: 'Fatigue drift → care break', short: 'Break' },
];

class Cancelled extends Error {}

let token = 0;
let navigator = (path) => { window.location.hash = path; };

// Registered by <DemoBridge/> inside the router (knows whether we are in the Stage View).
export function registerNavigator(fn) {
  navigator = fn;
}

const max = () => store.get().demo.pace === 'max';
export const MAX_HOLD_MS = 1500;

function makeCtx(myToken) {
  const alive = () => {
    if (myToken !== token) throw new Cancelled();
  };
  const tick = () => new Promise((r) => setTimeout(r, max() ? 20 : 80));
  // At max pace, waits are cut to 250 ms, except `hold` (the screen a step ends on), cut to 1.5 s.
  async function sleep(ms, maxCap = 250) {
    let left = max() ? Math.min(ms, maxCap) : ms;
    while (left > 0) {
      alive();
      const started = Date.now();
      await tick();
      if (!store.get().demo.paused) left -= Date.now() - started;
    }
    alive();
  }
  async function until(cond, timeoutMs = 90000) {
    let waited = 0;
    while (store.get().demo.paused || !cond()) {
      alive();
      await tick();
      if (!store.get().demo.paused) waited += max() ? 20 : 80;
      if (waited > timeoutMs) {
        addLog('events', { type: 'demo_timeout', time: '', detail: 'step wait timed out' });
        return;
      }
    }
    alive();
  }
  const idle = () => until(() => isIdle());
  // A screen's spoken briefing: wait until it has queued its lines and they have all been said.
  const briefing = async (id) => {
    await until(() => store.get().spokeOn.screen === id);
    await idle();
  };
  const nav = (path) => {
    alive();
    navigator(path);
  };
  const hold = (ms) => sleep(ms, MAX_HOLD_MS);
  return { alive, sleep, hold, until, idle, briefing, nav };
}

function forget(prefix) {
  store.set((s) => ({ briefed: Object.fromEntries(Object.entries(s.briefed).filter(([k]) => !k.startsWith(prefix))) }));
}

async function taskId() {
  const scenario = await loadScenario();
  return scenario?.task_id ?? store.get().plan?.tasks_ordered?.[0];
}

const STEP_RUN = [
  // 1. Morning (Hindi), fresh state.
  async (ctx) => {
    stopReplay();
    await api.reset();
    ctx.alive();
    const { theme, unlocked, apiMode, quiet, demo } = store.get();
    store.reset({ theme, unlocked, apiMode, quiet, lang: 'hi', demo: { ...demo, step: 1 } });
    resetVoice({ demo: true });
    await Promise.all([loadDay({ force: true }), loadMemory(), loadScenario()]);
    ctx.nav('/morning');
    await ctx.briefing('morning@1');
    await ctx.hold(1500);
  },
  // 2. Pre-task for the scenario's task.
  async (ctx) => {
    const id = await taskId();
    forget(`pretask:${id}`);
    ctx.nav(`/pretask/${id}`);
    await ctx.briefing(`pretask:${id}@${store.get().shift}`);
    await ctx.hold(1800);
  },
  // 3. In-task replay (fast-forward): idle lesson, belt before you move, proximity alert.
  async (ctx) => {
    const scenario = await loadScenario();
    ctx.nav(`/intask/${scenario.task_id}`);
    await ctx.sleep(600);
    startReplay(scenario, { speed: max() ? MAX_SPEED : DEMO_SPEED });
    await ctx.until(() => store.get().replay.done);
    await ctx.idle();
    await ctx.hold(1200);
  },
  // 4. Operator taps "person in zone" -> incident list.
  async (ctx) => {
    const id = await taskId();
    if (!store.get().replay.taskId) ctx.nav(`/intask/${id}`);
    await ctx.sleep(900);
    store.set({ incidentFlash: 'person_in_zone' });
    await ctx.sleep(500);
    await logIncident('person_in_zone', 'tap');
    await ctx.idle();
    store.set({ incidentFlash: null });
    ctx.nav('/incidents');
    await ctx.hold(3000);
  },
  // 5. Debrief.
  async (ctx) => {
    const id = await taskId();
    forget(`debrief:${id}`);
    store.set((s) => ({ debriefSeen: {}, taskStatus: { ...s.taskStatus, [id]: 'done' } }));
    ctx.nav(`/debrief/${id}`);
    await ctx.briefing(`debrief:${id}@${store.get().shift}`);
    await ctx.hold(2500);
  },
  // 6. Shift 2: different operator, same machine — Machine Memory carries the incident.
  async (ctx) => {
    if (!(await loadMemory()).length) {
      await logIncident('person_in_zone', 'tap');
      await ctx.idle();
    }
    stopReplay();
    patchDemo({ overlay: 'shift2' });
    await ctx.hold(2800);
    forget('morning@2');
    store.set({ shift: 2, operator: 'OP1002', taskStatus: {}, debrief: null, findings: null, lesson: null });
    patchDemo({ overlay: null });
    ctx.nav('/morning');
    await ctx.briefing('morning@2');
    await ctx.hold(1500);
  },
  // 7. (P1) Fatigue drift -> care mode break. Without the fatigue model, the planned break is shown.
  async (ctx) => {
    const finding = await checkFatigue();
    ctx.alive();
    if (finding) {
      ctx.nav('/break?reason=care');
      // One line per step: the finding already says "a short break will help".
      await sayInOrder([{ priority: 'care', mode: 'care', message_key: finding.message_key, slots: finding.slots }], { alive: () => { ctx.alive(); return true; } });
    } else {
      addLog('events', { type: 'fatigue_unavailable', time: '', detail: 'fatigue model not available — planned break' });
      ctx.nav('/break?reason=planned');
      await sayInOrder([{ priority: 'care', mode: 'care', message_key: 'break_time', slots: {} }], { alive: () => { ctx.alive(); return true; } });
    }
    await ctx.idle();
    await ctx.hold(3000);
  },
];

async function runFrom(index, myToken) {
  const ctx = makeCtx(myToken);
  try {
    for (let i = index; i < STEP_RUN.length; i += 1) {
      ctx.alive();
      patchDemo({ step: i + 1 });
      await STEP_RUN[i](ctx);
    }
    patchDemo({ running: false, paused: false, done: true });
    setFast(false);
  } catch (err) {
    if (!(err instanceof Cancelled)) {
      console.warn('Demo step failed', err); // eslint-disable-line no-console
      patchDemo({ running: false, paused: false });
    }
  }
}

// Things a step needs when it is jumped to directly.
async function prepareFor(index) {
  clearVoice();
  if (index !== 2) stopReplay();
  store.set({ safety: null, lesson: null, incidentFlash: null });
  if (index > 0) {
    await loadDay();
    await loadScenario();
  }
}

export async function goToStep(n) {
  const index = Math.max(0, Math.min(DEMO_STEPS.length - 1, n - 1));
  const myToken = ++token;
  setFast(max());
  patchDemo({ running: true, paused: false, done: false, step: index + 1 });
  await prepareFor(index);
  if (myToken !== token) return;
  runFrom(index, myToken);
}

export function startDemo() {
  store.set({ unlocked: true });
  return goToStep(1);
}

export function stopDemo() {
  token += 1;
  patchDemo({ running: false, paused: false, overlay: null });
  setFast(false);
}

export function togglePause() {
  const { demo } = store.get();
  if (!demo.running) return;
  if (demo.paused) {
    patchDemo({ paused: false });
    resumeReplay();
  } else {
    patchDemo({ paused: true });
    pauseReplay();
  }
}

export function nextStep() {
  const { step } = store.get().demo;
  return goToStep(Math.min(DEMO_STEPS.length, step + 1));
}

export function prevStep() {
  const { step } = store.get().demo;
  return goToStep(Math.max(1, step - 1));
}

export function setPace(pace) {
  patchDemo({ pace });
  if (store.get().demo.running) setFast(pace === 'max');
}
