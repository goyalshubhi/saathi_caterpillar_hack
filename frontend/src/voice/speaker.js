// Wraps the Web Speech API behind an injectable interface so it can be mocked in tests.
//
//   const speaker = createSpeaker();                         // browser: window.speechSynthesis
//   const speaker = createSpeaker({ synth, Utterance });     // tests: fakes
//
// speaker.speak(event, { onEnd }) renders a SaathiEvent and speaks it. If the event asks for
// Hindi but no Hindi voice is installed, it speaks English and sets speaker.fallbackToEnglish
// so the UI can show a visible warning. Without any speech API it is silent (onEnd fires at once).
import { render } from './templates.js';
import { modeSettings } from './modes.js';

export const VOICE_LANGS = { en: ['en-IN', 'en-GB', 'en-US', 'en'], hi: ['hi-IN', 'hi'] };

export function createSpeaker({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  const available = Boolean(synth && Utterance);
  let fallbackToEnglish = false;

  function findVoice(lang) {
    const list = available ? synth.getVoices() || [] : [];
    for (const code of VOICE_LANGS[lang] ?? [lang]) {
      const want = code.toLowerCase();
      const v = list.find((voice) => (voice.lang || '').toLowerCase().replace('_', '-').startsWith(want));
      if (v) return v;
    }
    return null;
  }

  function hasVoice(lang) {
    return findVoice(lang) !== null;
  }

  // The language that will actually be spoken for a requested language.
  function effectiveLang(lang) {
    if (lang !== 'hi') return lang;
    fallbackToEnglish = !hasVoice('hi');
    return fallbackToEnglish ? 'en' : 'hi';
  }

  function speak(event, { onEnd } = {}) {
    const lang = effectiveLang(event.lang ?? 'en');
    const text = render(event.message_key, event.slots ?? {}, lang);
    if (!available) {
      onEnd?.();
      return { text, lang };
    }
    const u = new Utterance(text);
    const { pitch, rate, volume } = modeSettings(event.mode);
    Object.assign(u, { pitch, rate, volume, lang: VOICE_LANGS[lang][0] });
    const voice = findVoice(lang);
    if (voice) u.voice = voice;
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    synth.speak(u);
    return { text, lang };
  }

  function cancel() {
    if (available) synth.cancel();
  }

  return {
    speak,
    cancel,
    hasVoice,
    get available() { return available; },
    get fallbackToEnglish() { return fallbackToEnglish; },
  };
}
