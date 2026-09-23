// The app's single voice pipeline: SaathiEvent -> voice queue (src/voice) -> speaker.
//
// Wraps the engine's speaker so the UI can see what happens to every line:
//   - store.speaking / store.caption follow the line being played (avatar + captions)
//   - store.log.queue records each decision for the Stage View:
//       spoken (with phrasing variant and MP3 / browser voice), held (coaching budget or quiet mode),
//       preempted by safety
// Mute ("Coaching mute" in the top bar, store.quiet): every line except safety is held, and a
// non-safety line that is playing when mute turns on is cut at once. Safety always speaks.
// "fast" mode (demo at max pace) plays nothing audible: the line is looked up and started (so the
// source is real), stopped at once, and reported finished after a short beat.
//
// Audio unlock: nothing is spoken before the "Start Saathi" click (browser autoplay rules). Lines
// that arrive earlier wait and play after it; screen briefings wait for it. If the browser still
// blocks a line later, it is retried silently on the next tap / key press (no overlay).
// Coaching mute: while quiet, only safety lines are spoken; the rest are shown as captions.
import { createQueue, createPhraser, createSpeaker, loadManifest, render, DEMO_SEED } from '../voice/index.js';
import { store, addLog, markArch, rememberUnlocked } from '../state/store.js';

const CAPTION_MS = 5000;
const FAST_LINE_MS = 120;
const SAFETY_BANNER_MS = 6500;
const LINE_GAP_MS = 900; // pause between lines spoken in sequence (sayInOrder)

let speaker = null;
let queue = null;
let fast = false;
let lineGap = LINE_GAP_MS;
let seq = 0;
let active = null; // { id, event, finished, onEnd }
let preemptor = null; // safety event currently being pushed
let captionTimer = null;
let bannerTimer = null;
const idleWaiters = new Set();
let held = []; // lines said before the unlock click, played right after it
let blocked = []; // retries for lines the browser blocked, run on the next user gesture

// Browser blocked a line after all (e.g. reload in the same session): retry it inside the next
// tap / key press, which the browser allows. Silent: no overlay, the line simply plays then.
function retryOnGesture(retry) {
  blocked.push(retry);
  if (blocked.length > 1 || typeof window === 'undefined') return;
  const run = () => {
    window.removeEventListener('pointerdown', run, true);
    window.removeEventListener('keydown', run, true);
    const retries = blocked;
    blocked = [];
    retries.forEach((r) => r());
  };
  window.addEventListener('pointerdown', run, true);
  window.addEventListener('keydown', run, true);
}

// The "Start Saathi" / demo start click. Must run inside a click handler.
export function unlockAudio() {
  if (!store.get().unlocked) store.set({ unlocked: true });
  rememberUnlocked();
  const waiting = held;
  held = [];
  waiting.forEach((e) => say(e));
}

// Resolves once audio is unlocked (at once if it already is).
export function whenUnlocked() {
  if (store.get().unlocked) return Promise.resolve();
  return new Promise((resolve) => {
    const off = store.subscribe(() => {
      if (store.get().unlocked) {
        off();
        resolve();
      }
    });
  });
}

function ensure() {
  if (!speaker) speaker = createSpeaker({ onBlocked: retryOnGesture });
  if (!queue) queue = createQueue({ speaker: instrumented, phraser: createPhraser() });
}

// Load pre-generated MP3 manifest (public/audio/manifest.json).
export async function initVoice() {
  ensure();
  const manifest = await loadManifest();
  if (manifest) speaker.setManifest(manifest);
  return Boolean(manifest);
}

// Tests inject a fake/silent speaker.
export function configureVoice({ speaker: s, seed, gapMs = 0 } = {}) {
  clearTimeout(captionTimer);
  lineGap = gapMs;
  speaker = s ?? createSpeaker({ onBlocked: retryOnGesture });
  active = null;
  held = [];
  blocked = [];
  queue = createQueue({ speaker: instrumented, phraser: createPhraser(seed === undefined ? {} : { seed }) });
  store.set({ speaking: null });
}

// New queue + phraser: demo mode uses the fixed DEMO_SEED so every run picks the same phrasings.
export function resetVoice({ demo = false } = {}) {
  ensure();
  queue.clear();
  queue = createQueue({ speaker: instrumented, phraser: createPhraser(demo ? { seed: DEMO_SEED } : {}) });
  queue.setQuiet(store.get().quiet);
  active = null;
  store.set({ speaking: null, caption: null, safety: null, lesson: null });
  notifyIdle();
}

export function setFast(on) {
  fast = Boolean(on);
}

function scheduleCaptionClear() {
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => store.set({ caption: null }), fast ? 600 : CAPTION_MS);
}

function finish(id, onEnd) {
  if (!active || active.id !== id || active.finished) return;
  active.finished = true;
  active = null;
  store.set({ speaking: null });
  scheduleCaptionClear();
  onEnd?.();
  notifyIdle();
}

const muted = (event) => store.get().quiet && event.priority !== 'safety';

const instrumented = {
  speak(event, { onEnd } = {}) {
    if (muted(event)) {
      // Queued before mute was switched on: skip it silently.
      addLog('queue', { decision: 'held-quiet', event, variant: event.variant ?? null });
      onEnd?.();
      return { text: '', lang: event.lang, source: 'silent' };
    }
    const id = ++seq;
    active = { id, event, finished: false, onEnd };
    const result = speaker.speak(event, { onEnd: () => finish(id, onEnd) }) ?? {};
    const source = result.source ?? 'silent';
    if (store.get().fallbackToEnglish !== speaker.fallbackToEnglish) store.set({ fallbackToEnglish: speaker.fallbackToEnglish });
    addLog('queue', { decision: 'spoken', event, text: result.text, lang: result.lang, source, variant: event.variant ?? 0 });
    markArch('saathi');
    clearTimeout(captionTimer);
    const caption = { id, text: result.text, priority: event.priority, key: event.message_key };
    const patch = { caption };
    if (event.message_key.startsWith('lesson_')) patch.lesson = { id, key: event.message_key, text: result.text };
    const stillPlaying = active && active.id === id;
    if (stillPlaying) patch.speaking = { id, event, text: result.text, lang: result.lang, source };
    store.set(patch);
    if (!stillPlaying) scheduleCaptionClear(); // silent speaker: the line already ended
    if (fast && stillPlaying) {
      speaker.cancel(); // look-up happened, nothing audible plays
      setTimeout(() => finish(id, onEnd), FAST_LINE_MS);
    }
    return result;
  },
  cancel() {
    if (active && !active.finished) {
      const cut = active.event;
      if (preemptor) addLog('queue', { decision: 'preempted', event: cut, by: preemptor.message_key, variant: cut.variant ?? 0 });
      active = null;
      store.set({ speaking: null });
    }
    speaker.cancel();
  },
};

function showSafety(event) {
  clearTimeout(bannerTimer);
  store.set({ safety: { id: ++seq, key: event.message_key, slots: event.slots, lang: event.lang } });
  bannerTimer = setTimeout(() => store.set({ safety: null }), fast ? 1500 : SAFETY_BANNER_MS);
}

// Coaching mute: show the line as a caption without speaking it.
function captionOnly(e) {
  const id = ++seq;
  clearTimeout(captionTimer);
  store.set({ caption: { id, text: render(e.message_key, e.slots, e.lang), priority: e.priority, key: e.message_key } });
  scheduleCaptionClear();
}

// Push one SaathiEvent. Returns the queue's { accepted, reason }.
export function say(event) {
  ensure();
  const e = { lang: store.get().lang, slots: {}, ...event };
  if (!store.get().unlocked) {
    held.push(e); // before the Start click: wait, play right after it
    return { accepted: true, reason: 'waiting-unlock' };
  }
  if (muted(e)) {
    captionOnly(e); // coaching mute: shown, not spoken
    addLog('queue', { decision: 'held-quiet', event: e, variant: null });
    return { accepted: false, reason: 'quiet' };
  }
  markArch('queue');
  if (e.priority === 'safety') preemptor = e;
  const result = queue.push(e);
  preemptor = null;
  if (!result.accepted) {
    addLog('queue', { decision: result.reason === 'budget' ? 'held-budget' : 'held-quiet', event: e, variant: null });
  } else if (e.priority === 'safety' && e.mode === 'alert' && e.banner !== false) {
    showSafety(e);
  }
  notifyIdle();
  return result;
}

export function isIdle() {
  return held.length === 0 && (!queue || (!queue.current && queue.pending.length === 0));
}

function notifyIdle() {
  if (!isIdle()) return;
  idleWaiters.forEach((w) => w());
  idleWaiters.clear();
}

// Resolves once nothing is playing or waiting.
export function whenIdle() {
  if (isIdle()) return Promise.resolve();
  return new Promise((resolve) => idleWaiters.add(resolve));
}

// Speak lines one after another (each waits for the previous to finish, then a short pause), so a
// safety line in a briefing never cuts off the line before it. Stops early if `alive()` turns false.
export async function sayInOrder(events, { alive = () => true } = {}) {
  await whenUnlocked(); // a screen opened behind the Start overlay briefs after the click
  for (let i = 0; i < events.length; i += 1) {
    await whenIdle();
    if (i > 0 && lineGap > 0 && !fast) {
      await new Promise((r) => setTimeout(r, lineGap));
      await whenIdle();
    }
    if (!alive()) return;
    say(events[i]);
  }
}

// Lines that open a screen: its one headline line
// plus any safety lines, in their original order. Saathi speaks on triggers, it does not read out
// the whole screen; the rest is on screen.
const HEADLINE_KEYS = ['greeting', 'pretask_estimate', 'debrief_over', 'debrief_on_time'];
export function triggerLines(events) {
  const lead = events.find((e) => HEADLINE_KEYS.includes(e.message_key)) ?? events.find((e) => e.priority !== 'safety');
  return events.filter((e) => e === lead || e.priority === 'safety');
}

export function repeat() {
  ensure();
  return queue.repeat();
}

export function clearVoice() {
  ensure();
  queue.clear();
  active = null;
  store.set({ speaking: null });
  notifyIdle();
}

export function startTask(taskId) {
  ensure();
  queue.startTask(taskId);
}

// Mute on/off. With `cut` (default) a non-safety line that is playing stops at once.
export function setQuiet(on, { cut = true } = {}) {
  ensure();
  queue.setQuiet(on);
  store.set({ quiet: Boolean(on) });
  if (on && cut && active && !active.finished && active.event.priority !== 'safety') {
    const { id, event, onEnd } = active;
    addLog('queue', { decision: 'muted', event, variant: event.variant ?? 0 });
    speaker.cancel();
    store.set({ caption: null });
    finish(id, onEnd); // lets the queue move on; queued non-safety lines are skipped
  }
}

export function voiceInfo() {
  ensure();
  return { available: speaker.available, fallbackToEnglish: speaker.fallbackToEnglish };
}
