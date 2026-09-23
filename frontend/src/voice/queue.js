// Priority queue in front of the speaker.
//
// - safety interrupts whatever is playing (unless it is also safety) and jumps the queue
// - care, coaching and info wait their turn (in that order)
// - interruption budget: at most ONE coaching line per task (safety/care/info are exempt)
// - quiet mode drops coaching lines only; safety is never muted
export const PRIORITY_ORDER = ['safety', 'care', 'coaching', 'info'];

const rank = (p) => {
  const i = PRIORITY_ORDER.indexOf(p);
  return i === -1 ? PRIORITY_ORDER.length : i;
};

export function createQueue({ speaker }) {
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

  return {
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
