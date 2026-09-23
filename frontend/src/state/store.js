// One tiny app-wide store (no state library): get / set / subscribe, read in React with useStore.
import { useSyncExternalStore } from 'react';

export const MACHINE_ID = 'EXC001';
const LOG_LIMIT = 40;

export function initialState() {
  return {
    lang: 'en',
    theme: 'dark',
    quiet: false, // coaching mute: only safety lines speak
    listening: false, // speech recognition is active (voice-command button pressed)
    unlocked: false,
    apiMode: 'unknown', // live | fixture
    fallbackToEnglish: false,

    // voice
    speaking: null, // { id, event, text, lang, source }
    caption: null, // { id, text, priority, key }
    safety: null, // { id, text } red banner on the In-task screen
    lesson: null, // { id, key, text } idle lesson card on the In-task screen
    briefed: {}, // screen@shift -> true, so briefings are spoken once
    spokeOn: { screen: null, n: 0 }, // bumped after a screen has queued its lines (demo waits on it)

    // shift
    shift: 1,
    operator: 'OP1001',
    machine: MACHINE_ID,

    // data from the API (contract shapes)
    tasks: null,
    weather: null,
    plan: null,
    predictions: {}, // task_id -> Prediction
    memory: [],
    incidents: [],
    scenario: null,
    debrief: null,
    findings: null,
    fatigue: null, // null = unknown, false = model not available, BehaviorFinding = detected
    taskStatus: {}, // task_id -> in_progress | done (local)
    debriefSeen: {},
    completedLessons: [],
    waved: false, // the avatar's one-time hello on the first Morning load
    incidentFlash: null, // category the demo "taps", so the button lights up

    // replay
    replay: { taskId: null, index: 0, total: 0, idle: false, playing: false, done: false, speed: 1, window: null },

    // Stage View logs (newest first)
    log: { telemetry: [], events: [], queue: [], model: [] },
    firedEvents: {}, // event type -> last fired id (lights up the pills)
    arch: { stage: null, n: 0 }, // architecture node that was just active

    // demo
    demo: { running: false, paused: false, step: 0, pace: 'normal', done: false, overlay: null },
    whatIf: null,
  };
}

export function createStore(init = initialState()) {
  let state = init;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    reset(overrides = {}) {
      state = { ...initialState(), ...overrides };
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const store = createStore();

export function useStore(selector) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

let logSeq = 0;
// Prepend an entry to one of the Stage View logs.
export function addLog(kind, entry) {
  store.set((s) => ({ log: { ...s.log, [kind]: [{ id: ++logSeq, at: Date.now(), ...entry }, ...s.log[kind]].slice(0, LOG_LIMIT) } }));
}

export function markArch(stage) {
  store.set((s) => ({ arch: { stage, n: s.arch.n + 1 } }));
}

export function patchDemo(patch) {
  store.set((s) => ({ demo: { ...s.demo, ...patch } }));
}

export function patchReplay(patch) {
  store.set((s) => ({ replay: { ...s.replay, ...patch } }));
}
