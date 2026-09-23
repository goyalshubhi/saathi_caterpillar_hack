import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TEMPLATES, SAFETY_KEYS, render, hasTemplate, slotNames, variantCount, phrasing } from './templates.js';
import { createPhraser, seededRandom } from './phrasing.js';
import { MODES } from './modes.js';
import { createSpeaker } from './speaker.js';
import { createQueue } from './queue.js';
import { matchCommand } from './commands.js';

// ---------- fakes ----------

// Fake speaker for queue tests: nothing finishes until the test calls finish().
function fakeSpeaker() {
  const calls = [];
  let onEnd = null;
  return {
    calls,
    cancels: 0,
    speak(event, opts) {
      calls.push(event.message_key);
      onEnd = opts.onEnd;
      return { text: event.message_key, lang: event.lang };
    },
    cancel() { this.cancels += 1; },
    finish() { const f = onEnd; onEnd = null; f?.(); },
  };
}

// Fake speechSynthesis + SpeechSynthesisUtterance for speaker tests.
function fakeSynth(voiceLangs) {
  const spoken = [];
  return {
    spoken,
    synth: {
      getVoices: () => voiceLangs.map((lang) => ({ lang, name: `voice-${lang}` })),
      speak: (u) => spoken.push(u),
      cancel: () => {},
    },
    Utterance: class { constructor(text) { this.text = text; } },
  };
}

const ev = (priority, message_key, extra = {}) => ({
  priority, message_key, mode: priority === 'safety' ? 'alert' : 'friendly', slots: {}, lang: 'en', ...extra,
});

// ---------- templates ----------

describe('templates', () => {
  it('every phrasing has en and hi with the same slots, and all phrasings of a key use the same slots', () => {
    for (const key of Object.keys(TEMPLATES)) {
      const slots0 = slotNames(phrasing(key, 'en', 0)).sort();
      for (let v = 0; v < variantCount(key); v += 1) {
        const en = phrasing(key, 'en', v);
        const hi = phrasing(key, 'hi', v);
        expect(en && hi, `${key}#${v}`).toBeTruthy();
        expect(slotNames(en).sort(), `${key}#${v} en`).toEqual(slots0);
        expect(slotNames(hi).sort(), `${key}#${v} hi`).toEqual(slots0);
      }
    }
  });

  it('safety lines have exactly one fixed phrasing', () => {
    for (const key of SAFETY_KEYS) {
      expect(hasTemplate(key), key).toBe(true);
      expect(typeof TEMPLATES[key].en, key).toBe('string');
      expect(typeof TEMPLATES[key].hi, key).toBe('string');
      expect(variantCount(key), key).toBe(1);
    }
  });

  it('every other key has 3 distinct, index-aligned phrasings in en and hi', () => {
    for (const key of Object.keys(TEMPLATES).filter((k) => !SAFETY_KEYS.includes(k))) {
      const { en, hi } = TEMPLATES[key];
      expect(Array.isArray(en) && Array.isArray(hi), key).toBe(true);
      expect(en.length, key).toBe(3);
      expect(hi.length, key).toBe(en.length);
      expect(new Set(en).size, key).toBe(en.length);
      expect(new Set(hi).size, key).toBe(hi.length);
    }
  });

  it('renders a chosen phrasing and wraps out-of-range variants', () => {
    expect(render('greeting', { count: 3 }, 'en', 1)).toBe('Good morning! Saathi here. 3 tasks lined up for today.');
    expect(render('greeting', { count: 3 }, 'hi', 1)).toBe('सुप्रभात! साथी बोल रहा हूँ। आज 3 काम तय हैं।');
    expect(render('greeting', { count: 3 }, 'en', 3)).toBe(render('greeting', { count: 3 }, 'en', 0));
    expect(render('belt_before_move', {}, 'en', 2)).toBe('Belt before you move! Fasten your seatbelt.');
  });

  it('fills slots in English', () => {
    const text = render('pretask_estimate', { task_type: 'Trenching', weather: 'Rainy', cat_min: 45, predicted_min: 52 }, 'en');
    expect(text).toBe('trenching, light rain. CAT estimate 45 minutes, I expect about 52 minutes.');
  });

  it('fills slots in Hindi and translates vocab', () => {
    const text = render('pretask_estimate', { task_type: 'Trenching', weather: 'Rainy', cat_min: 45, predicted_min: 52 }, 'hi');
    expect(text).toContain('खाई की खुदाई');
    expect(text).toContain('हल्की बारिश');
    expect(text).toContain('45');
    expect(text).toContain('52');
    expect(text).not.toMatch(/\{\w+\}/);
  });

  it('joins list slots per language', () => {
    expect(render('debrief_over', { over_min: 9, uncontrollable_min: 6, controllable_min: 3, factors: ['weather', 'machine_age'] }, 'en'))
      .toBe('9 minutes over. About 6 from rain and machine age, about 3 from idle gaps.');
    expect(render('debrief_over', { over_min: 9, uncontrollable_min: 6, controllable_min: 3, factors: ['weather', 'machine_age'] }, 'hi'))
      .toContain('बारिश और मशीन की उम्र');
  });

  it('leaves missing slots visible and throws on unknown keys', () => {
    expect(render('greeting', {}, 'en')).toContain('{count}');
    expect(() => render('no_such_key')).toThrow(/Unknown message key/);
  });

  it('covers every message_key used in contracts/examples', () => {
    const dir = fileURLToPath(new URL('../../../contracts/examples/', import.meta.url));
    const keys = new Set();
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        if (typeof v.message_key === 'string') keys.add(v.message_key);
        Object.values(v).forEach(walk);
      }
    };
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) walk(JSON.parse(readFileSync(dir + f, 'utf8')));
    expect(keys.size).toBeGreaterThan(3);
    for (const k of keys) expect(hasTemplate(k), k).toBe(true);
  });
});

// ---------- modes ----------

describe('modes', () => {
  it('matches the plan values', () => {
    expect(MODES.alert).toEqual({ pitch: 1.3, rate: 1.15, volume: 1.0 });
    expect(MODES.care).toEqual({ pitch: 0.9, rate: 0.85, volume: 0.8 });
    expect(Object.keys(MODES).sort()).toEqual(['alert', 'care', 'debrief', 'friendly']);
  });
});

// ---------- speaker ----------

describe('speaker', () => {
  it('speaks Hindi with a Hindi voice and mode settings', () => {
    const f = fakeSynth(['en-US', 'hi-IN']);
    const s = createSpeaker(f);
    const r = s.speak(ev('safety', 'belt_before_move', { lang: 'hi' }));
    expect(r.lang).toBe('hi');
    expect(s.fallbackToEnglish).toBe(false);
    const u = f.spoken[0];
    expect(u.voice.lang).toBe('hi-IN');
    expect([u.pitch, u.rate, u.volume]).toEqual([1.3, 1.15, 1.0]);
    expect(u.text).toContain('बेल्ट');
  });

  it('falls back to English and raises the flag when no Hindi voice exists', () => {
    const f = fakeSynth(['en-US']);
    const s = createSpeaker(f);
    const r = s.speak(ev('safety', 'belt_before_move', { lang: 'hi' }));
    expect(s.fallbackToEnglish).toBe(true);
    expect(r.lang).toBe('en');
    expect(f.spoken[0].text).toBe('Belt before you move! Fasten your seatbelt.');
  });

  // ----- pre-generated audio (manifest) -----

  const BELT_HI = render('belt_before_move', {}, 'hi');
  const MANIFEST = {
    entries: [
      { message_key: 'belt_before_move', lang: 'hi', mode: 'alert', text: BELT_HI, file: 'audio/hi/belt.mp3' },
      { message_key: 'greeting', lang: 'en', mode: 'friendly', text: render('greeting', { count: 3 }, 'en'), file: 'audio/en/g3.mp3' },
    ],
  };

  // Fake HTMLAudioElement: records instances; the test ends or fails playback by hand.
  function fakeAudio({ rejectPlay = false } = {}) {
    const made = [];
    class FakeAudio {
      constructor(src) { this.src = src; this.paused = true; made.push(this); }
      play() { this.paused = false; return rejectPlay ? Promise.reject(new Error('autoplay blocked')) : Promise.resolve(); }
      pause() { this.paused = true; }
    }
    return { made, Audio: FakeAudio };
  }

  it('plays the MP3 when the manifest has the exact rendered line', () => {
    const f = fakeSynth(['en-US']);                      // no Hindi voice installed
    const a = fakeAudio();
    const s = createSpeaker({ ...f, Audio: a.Audio, manifest: MANIFEST });
    let ended = false;
    const r = s.speak(ev('safety', 'belt_before_move', { lang: 'hi' }), { onEnd: () => { ended = true; } });
    expect(r).toEqual({ text: BELT_HI, lang: 'hi', source: 'audio' });
    expect(a.made.map((x) => x.src)).toEqual(['/audio/hi/belt.mp3']);
    expect(f.spoken).toEqual([]);
    expect(s.fallbackToEnglish).toBe(false);              // Hindi audio exists: no warning
    expect(ended).toBe(false);
    a.made[0].onended();
    expect(ended).toBe(true);
  });

  it('falls back to speechSynthesis on a manifest miss', () => {
    const f = fakeSynth(['en-US', 'hi-IN']);
    const a = fakeAudio();
    const s = createSpeaker({ ...f, Audio: a.Audio, manifest: MANIFEST });
    const r = s.speak(ev('info', 'greeting', { slots: { count: 4 } }));   // only count 3 is pre-rendered
    expect(r.source).toBe('speech');
    expect(a.made).toEqual([]);
    expect(f.spoken[0].text).toContain('4 tasks');
    const hit = s.speak(ev('info', 'greeting', { slots: { count: 3 } }));
    expect(hit.source).toBe('audio');
  });

  it('falls back to speechSynthesis when the MP3 fails to load', () => {
    const f = fakeSynth(['en-US', 'hi-IN']);
    const a = fakeAudio();
    const s = createSpeaker({ ...f, Audio: a.Audio, manifest: MANIFEST });
    let ends = 0;
    s.speak(ev('safety', 'belt_before_move', { lang: 'hi' }), { onEnd: () => { ends += 1; } });
    a.made[0].onerror();
    expect(f.spoken.map((u) => u.text)).toEqual([BELT_HI]);
    f.spoken[0].onend();
    a.made[0].onended?.();                               // a late event must not end the line twice
    expect(ends).toBe(1);
  });

  it('falls back to speechSynthesis when autoplay is blocked', async () => {
    const f = fakeSynth(['en-US', 'hi-IN']);
    const a = fakeAudio({ rejectPlay: true });
    const s = createSpeaker({ ...f, Audio: a.Audio, manifest: MANIFEST });
    s.speak(ev('safety', 'belt_before_move', { lang: 'hi' }));
    await Promise.resolve(); await Promise.resolve();
    expect(f.spoken.map((u) => u.text)).toEqual([BELT_HI]);
  });

  it('cancel stops the MP3 and does not fall back', async () => {
    const f = fakeSynth(['en-US', 'hi-IN']);
    const a = fakeAudio({ rejectPlay: true });
    const s = createSpeaker({ ...f, Audio: a.Audio, manifest: MANIFEST });
    s.speak(ev('safety', 'belt_before_move', { lang: 'hi' }));
    s.cancel();
    await Promise.resolve(); await Promise.resolve();
    expect(a.made[0].paused).toBe(true);
    expect(f.spoken).toEqual([]);
  });

  it('prefers the clip recorded in the same mode', () => {
    const text = render('break_time', {}, 'en');
    const manifest = { entries: [
      { message_key: 'break_time', lang: 'en', mode: 'friendly', text, file: 'audio/en/friendly.mp3' },
      { message_key: 'break_time', lang: 'en', mode: 'care', text, file: 'audio/en/care.mp3' },
    ] };
    const a = fakeAudio();
    const s = createSpeaker({ ...fakeSynth(['en-US']), Audio: a.Audio, manifest });
    s.speak({ priority: 'care', mode: 'care', message_key: 'break_time', slots: {}, lang: 'en' });
    expect(a.made[0].src).toBe('/audio/en/care.mp3');
  });

  it('the committed manifest points at real MP3 files for every entry', () => {
    const root = fileURLToPath(new URL('../../public/', import.meta.url));
    const manifest = JSON.parse(readFileSync(`${root}audio/manifest.json`, 'utf8'));
    expect(manifest.entries.length).toBeGreaterThan(50);
    for (const e of manifest.entries) {
      expect(render(e.message_key, {}, e.lang).length).toBeGreaterThan(0);   // key exists
      expect(readFileSync(root + e.file).length).toBeGreaterThan(1000);
    }
    for (const key of ['belt_before_move', 'seatbelt_unfastened', 'safety_alert', 'greeting', 'break_time', 'cmd_quiet_on', 'cmd_quiet_off']) {
      for (const lang of ['en', 'hi']) {
        expect(manifest.entries.some((e) => e.message_key === key && e.lang === lang), `${key}/${lang}`).toBe(true);
      }
    }
  });

  it('is silent but still completes without a speech API', () => {
    const s = createSpeaker({ synth: null, Utterance: null });
    let ended = false;
    const r = s.speak(ev('info', 'greeting', { slots: { count: 3 } }), { onEnd: () => { ended = true; } });
    expect(ended).toBe(true);
    expect(r.text).toContain('3 tasks');
  });
});

// ---------- queue ----------

describe('queue', () => {
  let sp;
  let q;
  beforeEach(() => {
    sp = fakeSpeaker();
    q = createQueue({ speaker: sp });
    q.startTask('T101');
  });

  it('plays in priority order: safety, care, coaching, info', () => {
    q.push(ev('info', 'greeting'));        // starts immediately
    q.push(ev('coaching', 'lesson_hydration'));
    q.push(ev('care', 'break_time'));
    q.push(ev('info', 'rain_today'));
    sp.finish(); sp.finish(); sp.finish(); sp.finish();
    expect(sp.calls).toEqual(['greeting', 'break_time', 'lesson_hydration', 'rain_today']);
  });

  it('safety preempts coaching immediately', () => {
    q.push(ev('coaching', 'lesson_idle_engine_off'));
    expect(q.current.message_key).toBe('lesson_idle_engine_off');
    q.push(ev('safety', 'belt_before_move'));
    expect(sp.cancels).toBe(1);
    expect(q.current.message_key).toBe('belt_before_move');
    sp.finish();
    expect(q.current).toBe(null); // interrupted coaching is dropped, not replayed
    expect(sp.calls).toEqual(['lesson_idle_engine_off', 'belt_before_move']);
  });

  it('safety does not cut off another safety line', () => {
    q.push(ev('safety', 'belt_before_move'));
    q.push(ev('safety', 'proximity_alert'));
    expect(sp.cancels).toBe(0);
    sp.finish();
    expect(q.current.message_key).toBe('proximity_alert');
  });

  it('interrupted care line is replayed after safety', () => {
    q.push(ev('care', 'care_break'));
    q.push(ev('safety', 'safety_alert'));
    sp.finish();
    expect(q.current.message_key).toBe('care_break');
  });

  it('budget blocks the second coaching line in the same task', () => {
    expect(q.push(ev('coaching', 'lesson_hydration')).accepted).toBe(true);
    expect(q.push(ev('coaching', 'lesson_walkaround'))).toEqual({ accepted: false, reason: 'budget' });
    q.startTask('T102');
    expect(q.push(ev('coaching', 'lesson_walkaround')).accepted).toBe(true);
  });

  it('budget never blocks safety', () => {
    q.push(ev('coaching', 'lesson_hydration'));
    for (let i = 0; i < 3; i += 1) expect(q.push(ev('safety', 'safety_alert')).accepted).toBe(true);
  });

  it('quiet mode mutes coaching but never safety or care', () => {
    q.setQuiet(true);
    expect(q.push(ev('coaching', 'lesson_hydration'))).toEqual({ accepted: false, reason: 'quiet' });
    expect(q.push(ev('safety', 'belt_before_move')).accepted).toBe(true);
    expect(q.push(ev('care', 'care_break')).accepted).toBe(true);
    q.setQuiet(false);
    expect(q.push(ev('coaching', 'lesson_hydration')).accepted).toBe(true); // quiet drop did not use the budget
  });

  it('repeat replays the last line', () => {
    q.push(ev('info', 'greeting'));
    sp.finish();
    q.repeat();
    expect(sp.calls).toEqual(['greeting', 'greeting']);
  });
});

// ---------- commands ----------

describe('commands', () => {
  it.each([
    ['repeat', 'repeat'],
    ['Say that again please', 'repeat'],
    ['फिर से बोलो', 'repeat'],
    ['log incident', 'log_incident'],
    ['घटना दर्ज करो', 'log_incident'],
    ["I'm taking a break", 'taking_break'],
    ['आराम', 'taking_break'],
    ['quiet mode', 'quiet_mode'],
    ['चुप रहो', 'quiet_mode'],
    ['shant', 'quiet_mode'],
  ])('%s -> %s', (text, id) => {
    expect(matchCommand(text)).toBe(id);
  });

  it('returns null for anything else (not a chatbot)', () => {
    expect(matchCommand('what is the weather like')).toBe(null);
    expect(matchCommand('')).toBe(null);
    expect(matchCommand('breakfast')).toBe(null);
  });
});

// ---------- phrasing variants ----------

describe('phraser', () => {
  const sequence = (phraser, key, n) => Array.from({ length: n }, () => phraser.pick(key));

  it('is deterministic for a seed (demo mode)', () => {
    expect(sequence(createPhraser({ seed: 42 }), 'greeting', 10)).toEqual(sequence(createPhraser({ seed: 42 }), 'greeting', 10));
    expect(sequence(createPhraser({ seed: 42 }), 'greeting', 10)).not.toEqual(sequence(createPhraser({ seed: 7 }), 'greeting', 10));
  });

  it('never repeats the same phrasing twice in a row and uses every phrasing', () => {
    const seq = sequence(createPhraser({ seed: 1 }), 'break_time', 60);
    for (let i = 1; i < seq.length; i += 1) expect(seq[i]).not.toBe(seq[i - 1]);
    expect(new Set(seq)).toEqual(new Set([0, 1, 2]));
  });

  it('always picks the single phrasing for safety lines', () => {
    const p = createPhraser({ seed: 3 });
    expect(sequence(p, 'belt_before_move', 5)).toEqual([0, 0, 0, 0, 0]);
    expect(sequence(p, 'warn.rain_slippery', 3)).toEqual([0, 0, 0]);
  });

  it('is random without a seed (injectable random source)', () => {
    expect(createPhraser({ random: () => 0.99 }).pick('greeting')).toBe(2);
    expect(createPhraser({ random: () => 0 }).pick('greeting')).toBe(0);
  });

  it('seededRandom yields floats in [0, 1)', () => {
    const r = seededRandom(42);
    for (let i = 0; i < 100; i += 1) {
      const x = r();
      expect(x >= 0 && x < 1).toBe(true);
    }
  });
});

describe('queue + speaker with phrasings', () => {
  function recordingSpeaker() {
    const events = [];
    return { events, speak(e, { onEnd }) { events.push(e); onEnd(); return {}; }, cancel() {} };
  }

  it('assigns a variant to each accepted line; seeded runs are identical', () => {
    const run = () => {
      const sp = recordingSpeaker();
      const q = createQueue({ speaker: sp, phraser: createPhraser({ seed: 42 }) });
      ['greeting', 'break_time', 'greeting', 'belt_before_move'].forEach((k) => q.push(ev('info', k)));
      return sp.events.map((e) => e.variant);
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a[3]).toBe(0); // safety line
    expect(a[2]).not.toBe(a[0]); // no immediate repeat for the same key
  });

  it('keeps an explicit variant and repeat() says the same words', () => {
    const sp = recordingSpeaker();
    const q = createQueue({ speaker: sp, phraser: createPhraser({ seed: 42 }) });
    q.push(ev('info', 'greeting', { variant: 2 }));
    q.repeat();
    expect(sp.events.map((e) => e.variant)).toEqual([2, 2]);
  });

  it('an explicit variant counts as the last phrasing: the next auto-pick for that key differs', () => {
    for (const n of [0, 1, 2]) {
      for (const r of [0, 0.34, 0.67, 0.99]) {
        const sp = recordingSpeaker();
        const q = createQueue({ speaker: sp, phraser: createPhraser({ random: () => r }) });
        q.push(ev('info', 'greeting', { variant: n }));
        q.push(ev('info', 'greeting'));
        expect(sp.events[1].variant, `explicit ${n}, random ${r}`).not.toBe(n);
      }
    }
  });

  it('speaker renders the chosen phrasing, and the English fallback uses the same phrasing', () => {
    const f = fakeSynth(['en-US']);
    const s = createSpeaker(f);
    s.speak(ev('info', 'greeting', { slots: { count: 3 }, lang: 'hi', variant: 1 }));
    expect(f.spoken[0].text).toBe('Good morning! Saathi here. 3 tasks lined up for today.');
  });
});
