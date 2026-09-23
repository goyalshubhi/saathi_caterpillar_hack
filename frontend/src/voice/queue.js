// Priority queue in front of the speaker.
//
// - safety interrupts whatever is playing (unless it is also safety) and jumps the queue
// - care, coaching and info wait their turn (in that order)
// - interruption budget: at most ONE coaching line per task (safety/care/info are exempt)
// - quiet mode drops coaching lines only; safety is never muted
// - each accepted line gets a phrasing (event.variant) from the phraser, unless it already has one;
//   repeat() replays the exact same words
import { createPhraser } from './phrasing.js';

export const PRIORITY_ORDER = ['safety', 'care', 'coaching', 'info'];

const rank = (p) => {
  const i = PRIORITY_ORDER.indexOf(p);
  return i === -1 ? PRIORITY_ORDER.length : i;
};

export function createQueue({ speaker, phraser = createPhraser() }) {
  let current = null; // { event, token }
  let token = 0;
  const pending = [];
  let quiet = false;
  let taskId = null;
  const coachedTasks = new Set();
  const spoken = []; // history: { event, text, lang }
  let lastSpoken = null;

  function pump() {
    if (current || pending.length === 0) return;
    const event = pending.shift();
    const myToken = ++token;
    current = { event, token: myToken };
    const onEnd = () => {
      if (current && current.token === myToken) {
        current = null;
        pump();
      }
    };
    lastSpoken = event;
    const result = speaker.speak(event, { onEnd }) ?? {};
    spoken.push({ event, text: result.text, lang: result.lang });
  }

  function enqueue(event) {
    const r = rank(event.priority);
    const i = pending.findIndex((e) => rank(e.priority) > r);
    pending.splice(i === -1 ? pending.length : i, 0, event);
  }

  // Returns { accepted, reason } where reason is 'quiet' | 'budget' | null.
  function push(event) {
    if (event.priority === 'coaching') {
      if (quiet) return { accepted: false, reason: 'quiet' };
      const key = taskId ?? '__none__';
      if (coachedTasks.has(key)) return { accepted: false, reason: 'budget' };
      coachedTasks.add(key);
    }
    if (event.variant === undefined) event = { ...event, variant: phraser.pick(event.message_key) };
    else phraser.note?.(event.message_key, event.variant); // so the next auto-pick doesn't repeat it
    if (event.priority === 'safety' && current && current.event.priority !== 'safety') {
      const interrupted = current.event;
      current = null; // clear first: cancel() may fire the old onEnd synchronously
      speaker.cancel();
      if (interrupted.priority === 'care') enqueue(interrupted); // care is replayed; coaching/info dropped
    }
    enqueue(event);
    pump();
    return { accepted: true, reason: null };
  }

  // "Repeat" command: say the last line again (not counted against the budget).
  function repeat() {
    if (!lastSpoken) return { accepted: false, reason: 'nothing' };
    enqueue(lastSpoken);
    pump();
    return { accepted: true, reason: null };
  }

  function clear() {
    pending.length = 0;
    if (current) {
      current = null;
      speaker.cancel();
    }
  }

  // Remove waiting lines that match `pred` (the line playing now is not touched).
  function dropPending(pred) {
    for (let i = pending.length - 1; i >= 0; i -= 1) if (pred(pending[i])) pending.splice(i, 1);
  }

  return {
    dropPending,
    push,
    repeat,
    clear,
    startTask(id) { taskId = id; },
    setQuiet(on) { quiet = Boolean(on); },
    get quiet() { return quiet; },
    get current() { return current ? current.event : null; },
    get pending() { return [...pending]; },
    get spoken() { return [...spoken]; },
  };
}
