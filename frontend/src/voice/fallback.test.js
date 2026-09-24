import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFallbackIndicator, fallbackReason, FALLBACK_SHOW_MS } from './fallback.js';
import { createQueue } from './queue.js';
import { unlockAudio } from './unlock.js';
import { servingProblem, SERVE_MESSAGE } from '../serving.js';

unlockAudio(); // these tests start after the Start button's click

function manualTimers() {
  const timers = new Map();
  let id = 0;
  return {
    setTimer: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearTimer: (i) => timers.delete(i),
    fireAll: () => { for (const [i, t] of [...timers]) { timers.delete(i); t.fn(); } },
    get size() { return timers.size; },
  };
}

// Speaker whose speak() result is mocked.
const mockedSpeaker = (result, { fallbackToEnglish = false } = {}) => ({
  fallbackToEnglish,
  speak: (e, { onEnd } = {}) => { onEnd?.(); return { text: e.message_key, lang: e.lang, ...result }; },
  cancel() {},
});

const LINE = { priority: 'info', mode: 'friendly', message_key: 'greeting', slots: { count: 3 }, lang: 'en' };

function wired(result, opts) {
  const t = manualTimers();
  const indicator = createFallbackIndicator({ setTimer: t.setTimer, clearTimer: t.clearTimer });
  const speaker = mockedSpeaker(result, opts);
  const queue = createQueue({ speaker, onSpeak: (r) => indicator.report(r, speaker) });
  return { t, indicator, queue };
}

describe('fallback voice indicator', () => {
  it("appears when a line's source is 'tts' (no pre-rendered MP3)", () => {
    const { indicator, queue } = wired({ source: 'tts' });
    const seen = [];
    indicator.subscribe((s) => seen.push(s.visible));
    queue.push(LINE);
    expect(indicator.state).toEqual({ visible: true, reason: 'speech', label: 'backup voice' });
    expect(seen).toEqual([false, true]);
  });

  it("does not appear when the line played from pre-rendered audio", () => {
    const { indicator, queue, t } = wired({ source: 'audio' });
    queue.push(LINE);
    expect(indicator.state.visible).toBe(false);
    expect(t.size).toBe(0);
  });

  it('appears for the English fallback and for no voice at all', () => {
    const english = wired({ source: 'tts' }, { fallbackToEnglish: true });
    english.queue.push({ ...LINE, lang: 'hi' });
    expect(english.indicator.state.reason).toBe('english');
    const silent = wired({ source: 'silent' });
    silent.queue.push(LINE);
    expect(silent.indicator.state.reason).toBe('silent');
  });

  it('is brief: hides after FALLBACK_SHOW_MS, and a new fallback restarts it', () => {
    const { indicator, queue, t } = wired({ source: 'tts' });
    queue.push(LINE);
    queue.push(LINE);
    expect(t.size).toBe(1);                              // restarted, not stacked
    t.fireAll();
    expect(indicator.state.visible).toBe(false);
    expect(FALLBACK_SHOW_MS).toBe(3000);
  });

  it('labels follow the language', () => {
    const t = manualTimers();
    const indicator = createFallbackIndicator({ lang: 'hi', setTimer: t.setTimer, clearTimer: t.clearTimer });
    indicator.report({ source: 'tts' }, { fallbackToEnglish: false });
    expect(indicator.state.label).toBe('बैकअप आवाज़');
  });

  it('fallbackReason ignores audio and empty results', () => {
    expect(fallbackReason({ source: 'audio' }, { fallbackToEnglish: true })).toBe(null);
    expect(fallbackReason(undefined)).toBe(null);
  });

  it('knows a Hindi line spoken from an English MP3 is the English fallback', () => {
    const hiLine = { ...LINE, lang: 'hi' };
    expect(fallbackReason({ source: 'audio', lang: 'en' }, { fallbackToEnglish: true }, hiLine)).toBe('english');
    expect(fallbackReason({ source: 'audio', lang: 'hi' }, { fallbackToEnglish: false }, hiLine)).toBe(null);
    // an English line after a Hindi fallback: the speaker's stale flag is ignored when the line is known
    expect(fallbackReason({ source: 'tts', lang: 'en' }, { fallbackToEnglish: true }, LINE)).toBe('speech');
  });
});

describe('serving check', () => {
  it('flags file:// and passes http(s)', () => {
    expect(servingProblem({ protocol: 'file:' })).toBe(SERVE_MESSAGE);
    expect(SERVE_MESSAGE).toBe('Must be served via a dev server (npm run dev), not opened directly.');
    expect(servingProblem({ protocol: 'http:' })).toBe(null);
    expect(servingProblem({ protocol: 'https:' })).toBe(null);
    expect(servingProblem(undefined)).toBe(null);          // Node / tests: no location
  });

  it('index.html shows the same message when opened as file:// (module scripts cannot load there)', () => {
    const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
    const inline = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
    expect(inline).toContain("location.protocol === 'file:'");
    expect(inline).toContain(SERVE_MESSAGE);
  });
});
