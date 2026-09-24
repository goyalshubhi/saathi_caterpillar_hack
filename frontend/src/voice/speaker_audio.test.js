import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSpeaker, loadManifest } from './speaker.js';
import { render, variantCount } from './templates.js';
import { unlockAudio } from './unlock.js';

unlockAudio(); // these tests start after the Start button's click (see unlock.test.js for before it)

const BELT_HI = render('belt_before_move', {}, 'hi');
const BELT_EN = render('belt_before_move', {}, 'en');

const MANIFEST = {
  entries: [
    { message_key: 'belt_before_move', lang: 'hi', mode: 'alert', text: BELT_HI, file: 'audio/hi/belt.mp3' },
    { message_key: 'belt_before_move', lang: 'en', mode: 'alert', text: BELT_EN, file: 'audio/en/belt.mp3' },
    { message_key: 'proximity_alert', lang: 'hi', mode: 'alert', text: render('proximity_alert', { distance_m: 2.1 }, 'hi'), file: 'audio/hi/prox21.mp3' },
  ],
};

// Fake HTMLAudioElement: records instances; tests fire onended / onerror by hand.
function fakeAudioClass({ rejectPlay = false } = {}) {
  const instances = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.paused = true;
      instances.push(this);
    }
    play() {
      this.paused = false;
      return rejectPlay ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve();
    }
    pause() { this.paused = true; }
  }
  return { FakeAudio, instances };
}

function fakeSynth(voiceLangs) {
  const spoken = [];
  return {
    spoken,
    synth: {
      getVoices: () => voiceLangs.map((lang) => ({ lang })),
      speak: (u) => spoken.push(u),
      cancel: () => {},
    },
    Utterance: class { constructor(text) { this.text = text; } },
  };
}

const belt = (lang) => ({ priority: 'safety', mode: 'alert', message_key: 'belt_before_move', slots: {}, lang });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('speaker with pre-generated audio', () => {
  let tts;
  let audio;
  beforeEach(() => {
    tts = fakeSynth(['en-IN', 'hi-IN']);
    audio = fakeAudioClass();
  });

  it('manifest hit: plays the MP3 and does not use speechSynthesis', () => {
    const s = createSpeaker({ ...tts, Audio: audio.FakeAudio, manifest: MANIFEST });
    let ended = 0;
    const r = s.speak(belt('hi'), { onEnd: () => { ended += 1; } });
    expect(r).toEqual({ text: BELT_HI, lang: 'hi', source: 'audio' });
    expect(audio.instances.map((a) => a.src)).toEqual(['/audio/hi/belt.mp3']);
    expect(tts.spoken).toHaveLength(0);
    expect(ended).toBe(0);
    audio.instances[0].onended();
    expect(ended).toBe(1);
  });

  it('manifest hit needs the exact rendered text (slots included)', () => {
    const s = createSpeaker({ ...tts, Audio: audio.FakeAudio, manifest: MANIFEST });
    const ev = { priority: 'safety', mode: 'alert', message_key: 'proximity_alert', lang: 'hi' };
    expect(s.speak({ ...ev, slots: { distance_m: 2.1 } }).source).toBe('audio');
    expect(s.speak({ ...ev, slots: { distance_m: 3 } }).source).toBe('tts');
    expect(tts.spoken.map((u) => u.text)).toEqual([render('proximity_alert', { distance_m: 3 }, 'hi')]);
  });

  it('manifest miss falls back to speechSynthesis', () => {
    const s = createSpeaker({ ...tts, Audio: audio.FakeAudio, manifest: MANIFEST });
    const r = s.speak({ priority: 'info', mode: 'friendly', message_key: 'greeting', slots: { count: 3 }, lang: 'hi' });
    expect(r.source).toBe('tts');
    expect(audio.instances).toHaveLength(0);
    expect(tts.spoken[0].text).toBe(render('greeting', { count: 3 }, 'hi'));
    expect(tts.spoken[0].voice.lang).toBe('hi-IN');
  });

  it('no manifest at all behaves exactly like plain speechSynthesis', () => {
    const s = createSpeaker({ ...tts, Audio: audio.FakeAudio });
    expect(s.speak(belt('hi')).source).toBe('tts');
    expect(audio.instances).toHaveLength(0);
  });

  it('Hindi MP3 plays even when the device has no Hindi voice (no fallback warning)', () => {
    const noHindi = fakeSynth(['en-US']);
    const s = createSpeaker({ ...noHindi, Audio: audio.FakeAudio, manifest: MANIFEST });
    expect(s.speak(belt('hi')).lang).toBe('hi');
    expect(s.fallbackToEnglish).toBe(false);
  });

  it('miss in Hindi without a Hindi voice uses the English MP3 and raises the flag', () => {
    const noHindi = fakeSynth(['en-US']);
    const onlyEn = { entries: MANIFEST.entries.filter((e) => e.lang === 'en') };
    const s = createSpeaker({ ...noHindi, Audio: audio.FakeAudio, manifest: onlyEn });
    const r = s.speak(belt('hi'));
    expect(r).toEqual({ text: BELT_EN, lang: 'en', source: 'audio' });
    expect(s.fallbackToEnglish).toBe(true);
    expect(audio.instances[0].src).toBe('/audio/en/belt.mp3');
  });

  it('a clip that fails to load falls back to speechSynthesis and still ends', () => {
    const s = createSpeaker({ ...tts, Audio: audio.FakeAudio, manifest: MANIFEST });
    let ended = 0;
    s.speak(belt('hi'), { onEnd: () => { ended += 1; } });
    audio.instances[0].onerror();
    expect(tts.spoken.map((u) => u.text)).toEqual([BELT_HI]);
    tts.spoken[0].onend();
    expect(ended).toBe(1);
  });

  it('a blocked play() (autoplay policy) falls back to speechSynthesis', async () => {
    const blocked = fakeAudioClass({ rejectPlay: true });
    const s = createSpeaker({ ...tts, Audio: blocked.FakeAudio, manifest: MANIFEST });
    s.speak(belt('en'));
    await tick();
    expect(tts.spoken.map((u) => u.text)).toEqual([BELT_EN]);
  });

  it('cancel stops the clip; a cancelled clip never ends or falls back', () => {
    const s = createSpeaker({ ...tts, Audio: audio.FakeAudio, manifest: MANIFEST });
    let ended = 0;
    s.speak(belt('hi'), { onEnd: () => { ended += 1; } });
    s.cancel();
    expect(audio.instances[0].paused).toBe(true);
    audio.instances[0].onerror();
    audio.instances[0].onended();
    expect(ended).toBe(0);
    expect(tts.spoken).toHaveLength(0);
  });

  it('setManifest swaps the manifest later (after an async load)', () => {
    const s = createSpeaker({ ...tts, Audio: audio.FakeAudio });
    expect(s.speak(belt('hi')).source).toBe('tts');
    s.setManifest(MANIFEST);
    expect(s.speak(belt('hi')).source).toBe('audio');
  });
});

describe('loadManifest', () => {
  it('returns the JSON, or null when missing or offline', async () => {
    expect(await loadManifest('/m.json', async () => ({ ok: true, json: async () => MANIFEST }))).toBe(MANIFEST);
    expect(await loadManifest('/m.json', async () => ({ ok: false }))).toBe(null);
    expect(await loadManifest('/m.json', async () => { throw new Error('offline'); })).toBe(null);
  });
});

describe('committed audio manifest', () => {
  const publicDir = fileURLToPath(new URL('../../public/', import.meta.url));
  const manifest = JSON.parse(readFileSync(`${publicDir}audio/manifest.json`, 'utf8'));

  it('every entry matches what render() produces in JS, and its MP3 exists', () => {
    expect(manifest.entries.length).toBeGreaterThan(20);
    for (const e of manifest.entries) {
      expect(render(e.message_key, e.slots, e.lang, e.variant), `${e.message_key}#${e.variant}/${e.lang}`).toBe(e.text);
      expect(existsSync(publicDir + e.file), e.file).toBe(true);
    }
  });

  it('covers the fixed safety, break and quiet-mode lines in both languages', () => {
    const have = new Set(manifest.entries.map((e) => `${e.message_key}/${e.lang}`));
    for (const key of ['belt_before_move', 'seatbelt_unfastened', 'safety_alert', 'break_time', 'care_break', 'cmd_quiet_on', 'cmd_quiet_off']) {
      for (const lang of ['en', 'hi']) expect(have.has(`${key}/${lang}`), `${key}/${lang}`).toBe(true);
    }
  });

  it('has an MP3 for every phrasing of each recorded line', () => {
    const variants = new Map();
    for (const e of manifest.entries) {
      const k = `${e.message_key}|${e.lang}|${e.mode}|${JSON.stringify(e.slots)}`;
      if (!variants.has(k)) variants.set(k, { key: e.message_key, seen: new Set() });
      variants.get(k).seen.add(e.variant);
    }
    for (const { key, seen } of variants.values()) expect(seen.size, key).toBe(variantCount(key));
  });
});
