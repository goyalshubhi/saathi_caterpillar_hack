// Fallback-voice indicator state (UI-free). A subtle cue, not an error: it shows briefly when a
// line was NOT a pre-rendered MP3, so a robotic or silent moment in the demo reads as "switched
// to the backup voice" rather than "something broke".
//
//   const indicator = createFallbackIndicator();
//   const queue = createQueue({ speaker, onSpeak: (result) => indicator.report(result, speaker) });
//   indicator.subscribe(({ visible, reason, label }) => render a small chip next to Saathi's status);
//
// reason: 'speech'  - device text-to-speech voice (no MP3 for this exact line)
//         'english' - no Hindi voice on the device, the line was spoken in English
//         'silent'  - no speech engine at all, the line was only shown
export const FALLBACK_SHOW_MS = 3000;

export const FALLBACK_LABELS = {
  speech: { en: 'backup voice', hi: 'बैकअप आवाज़' },
  english: { en: 'backup voice (English)', hi: 'बैकअप आवाज़ (अंग्रेज़ी)' },
  silent: { en: 'voice off: text only', hi: 'आवाज़ बंद: सिर्फ़ लिखा हुआ' },
};

export function fallbackReason(result, speaker) {
  if (!result || result.source === 'audio') return null;
  if (result.source === 'none') return 'silent';
  if (speaker?.fallbackToEnglish) return 'english';
  return result.source === 'speech' ? 'speech' : null;
}

export function createFallbackIndicator({
  showMs = FALLBACK_SHOW_MS,
  lang = 'en',
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  let state = { visible: false, reason: null, label: '' };
  let timer = null;
  const subscribers = new Set();

  function set(next) {
    state = next;
    for (const fn of subscribers) fn(state);
  }

  return {
    // Call with every speak() result; shows the cue for showMs, a fresh fallback restarts it.
    report(result, speaker) {
      const reason = fallbackReason(result, speaker);
      if (!reason) return;
      if (timer !== null) clearTimer(timer);
      set({ visible: true, reason, label: FALLBACK_LABELS[reason][lang] ?? FALLBACK_LABELS[reason].en });
      timer = setTimer(() => { timer = null; set({ visible: false, reason: null, label: '' }); }, showMs);
    },
    subscribe(fn) {
      subscribers.add(fn);
      fn(state);
      return () => subscribers.delete(fn);
    },
    setLang(l) { lang = l; },
    get state() { return state; },
  };
}
