// Audio unlock gate. Browsers block audio/speech until the user has interacted with the page, so
// the FIRST sound of a session must start inside a click handler. Call unlockAudio() only inside
// the onClick of the demo's "Start" / "Begin shift" button:
//
//   <button onClick={() => { unlockAudio(); startDemo(); }}>Begin shift</button>
//
// Until then the voice queue holds every line (nothing is spoken on mount, route load or data
// fetch); unlocking plays what was waiting. One flag per page, like the browser's own unlock.

let unlocked = false;
const listeners = new Set();

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  for (const fn of [...listeners]) fn();
}

export function isAudioUnlocked() {
  return unlocked;
}

// Run fn once audio is unlocked (immediately if it already is). Returns an unsubscribe function.
export function onAudioUnlock(fn) {
  if (unlocked) {
    fn();
    return () => {};
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Dev builds only (Vite / Vitest set import.meta.env.DEV); silent in production and plain Node.
export const IS_DEV = Boolean(import.meta.env?.DEV);
