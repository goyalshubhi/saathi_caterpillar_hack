// One replay at a time: plays a scenario through the replay engine (src/replay) and its rules,
// sends the resulting SaathiEvents to the voice runtime and logs everything for the Stage View.
// It keeps running if the operator leaves the In-task screen (the machine keeps working).
import { createPlayer, createRules } from '../replay/index.js';
import { store, addLog, markArch, patchReplay } from '../state/store.js';
import { say, startTask } from './voiceRuntime.js';

// Speeds are multiples of the demo pace: 1× plays one 15-min window every 5 s (engine speed 180),
// so 10× is one every 0.5 s and 60× one every ~0.08 s. The store keeps the multiple.
export const SPEEDS = [1, 10, 60];
export const BASE_SPEED = 180;
export const DEMO_SPEED = 1;
export const MAX_SPEED = 60;
const engineSpeed = (speed) => speed * BASE_SPEED;

let player = null;
let doneWaiters = [];

export function stopReplay() {
  player?.pause();
  player = null;
  patchReplay({ taskId: null, index: 0, total: 0, idle: false, playing: false, done: false, window: null });
}

export function startReplay(scenario, { speed = store.get().replay.speed, lessonKey } = {}) {
  player?.pause();
  const { lang } = store.get();
  const rules = createRules({ lang, lessonKey });
  startTask(scenario.task_id);
  patchReplay({ taskId: scenario.task_id, index: 0, total: scenario.windows.length, idle: false, playing: true, done: false, speed, window: null });
  store.set({ safety: null, lesson: null });
  const p = createPlayer(scenario.windows, {
    speed: engineSpeed(speed),
    onEvent(e) {
      if (e.type === 'tick') {
        const w = e.window;
        markArch('telemetry');
        addLog('telemetry', {
          time: w.timestamp.slice(11, 16), cycles: w.load_cycles, idle: w.idling_time_min,
          belt: w.seatbelt_status, alert: w.safety_alert_triggered, proximity: w.proximity_distance_m, active: w.machine_active,
        });
        patchReplay({ index: e.index + 1, idle: e.idle, window: w });
      } else {
        markArch('replay');
        addLog('events', { type: e.type, time: e.timestamp.slice(11, 16), detail: eventDetail(e) });
        store.set((s) => ({ firedEvents: { ...s.firedEvents, [e.type]: (s.firedEvents[e.type] ?? 0) + 1 } }));
        if (e.type === 'idle_end') store.set({ lesson: null }); // the idle lesson card goes when work resumes
      }
      const out = rules(e);
      if (out.length) markArch('rules');
      out.forEach((ev) => say({ ...ev, lang: store.get().lang }));
    },
    onDone() {
      patchReplay({ playing: false, done: true });
      store.set((s) => ({ taskStatus: { ...s.taskStatus, [scenario.task_id]: 'done' } }));
      doneWaiters.forEach((w) => w());
      doneWaiters = [];
    },
  });
  player = p;
  store.set((s) => ({ taskStatus: { ...s.taskStatus, [scenario.task_id]: 'in_progress' } }));
  p.play();
  return p;
}

function eventDetail(e) {
  switch (e.type) {
    case 'seatbelt_change': return `${e.from} → ${e.to}`;
    case 'safety_alert': return e.proximity_distance_m == null ? 'alert' : `${e.proximity_distance_m} m`;
    case 'idle_end':
    case 'resume_after_idle': return `${e.idle_minutes} min idle${e.seatbelt_status ? `, belt ${e.seatbelt_status}` : ''}`;
    default: return '';
  }
}

export function pauseReplay() {
  if (!player) return;
  player.pause();
  patchReplay({ playing: false });
}

export function resumeReplay() {
  if (!player || player.done) return;
  player.play();
  patchReplay({ playing: true });
}

export function setReplaySpeed(speed) {
  patchReplay({ speed });
  player?.setSpeed(engineSpeed(speed));
}

export function replayActive() {
  return Boolean(player);
}

export function whenReplayDone() {
  if (!player || player.done) return Promise.resolve();
  return new Promise((resolve) => doneWaiters.push(resolve));
}
