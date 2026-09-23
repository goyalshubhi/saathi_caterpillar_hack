// Speaks SaathiEvents. Behind an injectable interface so it can be mocked in tests.
//
//   const speaker = createSpeaker({ manifest: await loadManifest() });   // browser
//   const speaker = createSpeaker({ synth, Utterance, Audio, manifest });  // tests: fakes
//
// speaker.speak(event, { onEnd }) renders the event's line, then:
//   1. plays the pre-generated MP3 if the manifest has this exact (message_key, lang, text)
//      (offline neural voice, see scripts/generate_audio.py);
//   2. otherwise uses speechSynthesis. If Hindi is asked for but no Hindi voice is installed, it
//      speaks English (MP3 again if available) and sets speaker.fallbackToEnglish so the UI can
//      show a visible warning.
// If an MP3 fails to load or play, the same line falls back to speechSynthesis.
// Without any audio or speech API it is silent and onEnd fires at once.
import { render } from './templates.js';
import { modeSettings } from './modes.js';

export const VOICE_LANGS = { en: ['en-IN', 'en-GB', 'en-US', 'en'], hi: ['hi-IN', 'hi'] };
export const MANIFEST_URL = '/audio/manifest.json';

// Fetch the audio manifest; returns null if it is missing (speaker then uses speechSynthesis only).
export async function loadManifest(url = MANIFEST_URL, fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const lookupKey = (key, lang, text) => `${key}\u0000${lang}\u0000${text}`;

function indexManifest(manifest) {
  const index = new Map();
  for (const e of manifest?.entries ?? []) {
    const k = lookupKey(e.message_key, e.lang, e.text);
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(e);
  }
  return index;
}

export function createSpeaker({
  synth = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  Audio = globalThis.Audio,
  manifest = null,
  audioBase = '/',
} = {}) {
  const ttsAvailable = Boolean(synth && Utterance);
  let fallbackToEnglish = false;
  let index = indexManifest(manifest);
  let stopAudio = null;

  function findVoice(lang) {
    const list = ttsAvailable ? synth.getVoices() || [] : [];
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

  // Pre-generated clip for this exact line, preferring one recorded in the same mode.
  function findClip(key, lang, text, mode) {
    if (!Audio) return null;
    const hits = index.get(lookupKey(key, lang, text));
    if (!hits) return null;
    return hits.find((e) => e.mode === mode) ?? hits[0];
  }

  function playClip(clip, onEnd, onFail) {
    const audio = new Audio(audioBase + clip.file);
    let settled = false;
    const settle = (fn) => {
      if (settled) return;
      settled = true;
      if (stopAudio === stop) stopAudio = null;
      fn?.();
    };
    const stop = () => {
      settled = true; // a cancelled clip never reports end or failure
      audio.pause();
    };
    stopAudio = stop;
    audio.onended = () => settle(onEnd);
    audio.onerror = () => settle(onFail);
    const played = audio.play();
    if (played && typeof played.catch === 'function') played.catch(() => settle(onFail));
  }

  function speakTts(event, lang, text, onEnd) {
    if (!ttsAvailable) {
      onEnd?.();
      return;
    }
    const u = new Utterance(text);
    const { pitch, rate, volume } = modeSettings(event.mode);
    Object.assign(u, { pitch, rate, volume, lang: VOICE_LANGS[lang][0] });
    const voice = findVoice(lang);
    if (voice) u.voice = voice;
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    synth.speak(u);
  }

  function speak(event, { onEnd } = {}) {
    const key = event.message_key;
    const slots = event.slots ?? {};
    const requested = event.lang ?? 'en';

    // 1. Pre-generated audio in the requested language (works even without a Hindi TTS voice).
    const text = render(key, slots, requested);
    const clip = findClip(key, requested, text, event.mode);
    if (clip) {
      if (requested === 'hi') fallbackToEnglish = false;
      playClip(clip, onEnd, () => {
        const lang = effectiveLang(requested);
        speakTts(event, lang, render(key, slots, lang), onEnd);
      });
      return { text, lang: requested, source: 'audio' };
    }

    // 2. speechSynthesis, falling back to English when there is no Hindi voice.
    const lang = effectiveLang(requested);
    const spokenText = lang === requested ? text : render(key, slots, lang);
    const fallbackClip = lang !== requested ? findClip(key, lang, spokenText, event.mode) : null;
    if (fallbackClip) {
      playClip(fallbackClip, onEnd, () => speakTts(event, lang, spokenText, onEnd));
      return { text: spokenText, lang, source: 'audio' };
    }
    speakTts(event, lang, spokenText, onEnd);
    return { text: spokenText, lang, source: ttsAvailable ? 'tts' : 'silent' };
  }

  // The language speechSynthesis will actually use for a requested language.
  function effectiveLang(lang) {
    if (lang !== 'hi') return lang;
    fallbackToEnglish = !hasVoice('hi');
    return fallbackToEnglish ? 'en' : 'hi';
  }

  function cancel() {
    if (stopAudio) {
      stopAudio();
      stopAudio = null;
    }
    if (ttsAvailable) synth.cancel();
  }

  return {
    speak,
    cancel,
    hasVoice,
    setManifest(m) { index = indexManifest(m); },
    get available() { return ttsAvailable || Boolean(Audio && index.size); },
    get fallbackToEnglish() { return fallbackToEnglish; },
  };
}
