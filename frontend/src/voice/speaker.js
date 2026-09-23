// Speaks SaathiEvents. Pre-generated MP3s first (frontend/public/audio, made by `make audio`),
// the Web Speech API as fallback. Both are injectable so they can be mocked in tests.
//
//   const speaker = createSpeaker();                                   // browser: fetches the manifest
//   const speaker = createSpeaker({ synth, Utterance, manifest, Audio }); // tests: fakes
//
// speaker.speak(event, { onEnd }) renders a SaathiEvent. If the manifest has an MP3 for the exact
// rendered text (message_key + lang + text), it plays that; otherwise, or if playback fails, it
// uses speechSynthesis. If the event asks for Hindi, there is no MP3 and no Hindi voice is
// installed, it speaks English and sets speaker.fallbackToEnglish so the UI can show a visible
// warning. Without any speech API it is silent (onEnd fires at once).
import { render } from './templates.js';
import { modeSettings } from './modes.js';

export const VOICE_LANGS = { en: ['en-IN', 'en-GB', 'en-US', 'en'], hi: ['hi-IN', 'hi'] };
export const MANIFEST_URL = 'audio/manifest.json';

const indexKey = (key, lang, text) => `${key}\u0000${lang}\u0000${text}`;

// manifest.json -> Map(key+lang+text -> entries). Entries of the same text may differ by mode.
export function indexManifest(manifest) {
  const index = new Map();
  for (const e of manifest?.entries ?? []) {
    const k = indexKey(e.message_key, e.lang, e.text);
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(e);
  }
  return index;
}

export function createSpeaker({
  synth = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  Audio = globalThis.Audio,
  manifest,
  baseUrl = '/',
  fetchImpl = globalThis.fetch,
} = {}) {
  const available = Boolean(synth && Utterance);
  let fallbackToEnglish = false;
  let clips = indexManifest(manifest);
  let playing = null;

  // In the browser, load the manifest in the background; until it arrives, speechSynthesis is used.
  const ready = manifest === undefined && typeof window !== 'undefined' && fetchImpl
    ? fetchImpl(baseUrl + MANIFEST_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (m) clips = indexManifest(m); })
      .catch(() => {})
    : Promise.resolve();

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

  // The language speechSynthesis will actually use for a requested language.
  function effectiveLang(lang) {
    if (lang !== 'hi') return lang;
    fallbackToEnglish = !hasVoice('hi');
    return fallbackToEnglish ? 'en' : 'hi';
  }

  function findClip(event, lang, text) {
    const matches = clips.get(indexKey(event.message_key, lang, text));
    if (!matches) return null;
    return matches.find((e) => e.mode === (event.mode ?? 'friendly')) ?? matches[0];
  }

  function speakSynth(event, onEnd) {
    const lang = effectiveLang(event.lang ?? 'en');
    const text = render(event.message_key, event.slots ?? {}, lang);
    if (!available) {
      onEnd?.();
      return { text, lang, source: 'none' };
    }
    const u = new Utterance(text);
    const { pitch, rate, volume } = modeSettings(event.mode);
    Object.assign(u, { pitch, rate, volume, lang: VOICE_LANGS[lang][0] });
    const voice = findVoice(lang);
    if (voice) u.voice = voice;
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    synth.speak(u);
    return { text, lang, source: 'speech' };
  }

  function speak(event, { onEnd } = {}) {
    const lang = event.lang ?? 'en';
    const text = render(event.message_key, event.slots ?? {}, lang);
    const clip = Audio ? findClip(event, lang, text) : null;
    if (!clip) return speakSynth(event, onEnd);

    fallbackToEnglish = false;
    const audio = new Audio(baseUrl + clip.file);
    let settled = false;
    const settle = () => {
      if (settled) return false;
      settled = true;
      if (playing?.audio === audio) playing = null;
      return true;
    };
    playing = { audio, stop: () => { settle(); audio.pause?.(); } };
    audio.onended = () => { if (settle()) onEnd?.(); };
    // Missing file, decode error or autoplay block: speak the line instead.
    const fail = () => { if (settle()) speakSynth(event, onEnd); };
    audio.onerror = fail;
    Promise.resolve(audio.play?.()).catch(fail);
    return { text, lang, source: 'audio' };
  }

  function cancel() {
    playing?.stop();
    playing = null;
    if (available) synth.cancel();
  }

  return {
    speak,
    cancel,
    hasVoice,
    ready,
    get available() { return available; },
    get fallbackToEnglish() { return fallbackToEnglish; },
  };
}
