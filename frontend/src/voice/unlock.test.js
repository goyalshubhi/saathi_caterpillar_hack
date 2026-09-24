// Autoplay gate: before the Start button's click, setting up the whole voice + replay stack (what
// the app root does on mount / route load / data fetch) must not construct Audio or Utterance
// objects or call speechSynthesis.speak(). Lines queued meanwhile play right after the click.
// This file never unlocks at import time: it is the "before the first click" session.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSpeaker, createQueue, createBriefingGuard, createFallbackIndicator } from './index.js';
import { unlockAudio, isAudioUnlocked, onAudioUnlock } from './unlock.js';
import { connectReplay } from '../replay/index.js';

const demo = JSON.parse(readFileSync(fileURLToPath(new URL('../../../contracts/examples/demo_scenario.json', import.meta.url)), 'utf8'));

// Counting fakes for every way sound can start.
function countingAudioApis() {
  const counts = { audio: 0, play: 0, utterance: 0, synthSpeak: 0 };
  return {
    counts,
    Audio: class { constructor() { counts.audio += 1; } play() { counts.play += 1; return Promise.resolve(); } pause() {} },
    Utterance: class { constructor(text) { counts.utterance += 1; this.text = text; } },
    synth: { getVoices: () => [{ lang: 'hi-IN' }, { lang: 'en-IN' }], speak: () => { counts.synthSpeak += 1; }, cancel: () => {} },
  };
}

const NOTE = { id: 1, machine_id: 'EXC001', message_key: 'memory_incident', slots: { category: 'person_in_zone' } };

describe('audio unlock gate (before the first click)', () => {
  it('mounting the whole stack produces no sound and speaks nothing', async () => {
    expect(isAudioUnlocked()).toBe(false);
    const apis = countingAudioApis();
    const manifest = { entries: [] };
    const speaker = createSpeaker({ synth: apis.synth, Utterance: apis.Utterance, Audio: apis.Audio, manifest });
    const speakSpy = vi.spyOn(speaker, 'speak');
    const queue = createQueue({ speaker });
    createFallbackIndicator();
    // a task screen mounting straight after reload: briefing guard + replay start immediately
    await createBriefingGuard({ queue, fetchNotes: async () => [NOTE] }).ensureBriefed('EXC001');
    connectReplay(demo, { queue, lang: 'hi' }).runAll();

    expect(speakSpy).not.toHaveBeenCalled();
    expect(apis.counts).toEqual({ audio: 0, play: 0, utterance: 0, synthSpeak: 0 });
    expect(queue.current).toBe(null);
    expect(queue.pending[0].message_key).toBe('memory_incident');   // waiting, safety first
  });

  it('speak() called directly before unlock warns loudly in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const apis = countingAudioApis();
    const speaker = createSpeaker({ synth: apis.synth, Utterance: apis.Utterance, Audio: apis.Audio, manifest: { entries: [] } });
    speaker.speak({ priority: 'info', mode: 'friendly', message_key: 'greeting', slots: { count: 3 }, lang: 'en' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/before unlockAudio\(\)/);
    warn.mockRestore();
  });

  it('the Start click (unlockAudio) plays what was waiting, in order', () => {
    const apis = countingAudioApis();
    const speaker = createSpeaker({ synth: apis.synth, Utterance: apis.Utterance, Audio: apis.Audio, manifest: { entries: [] } });
    const spoken = [];
    const queue = createQueue({ speaker, onSpeak: (r, e) => spoken.push(e.message_key) });
    queue.push({ priority: 'info', mode: 'friendly', message_key: 'greeting', slots: { count: 3 }, lang: 'en' });
    queue.push({ priority: 'safety', mode: 'alert', message_key: 'memory_incident', slots: { category: 'near_miss' }, lang: 'en' });
    expect(spoken).toEqual([]);

    let heard = false;
    onAudioUnlock(() => { heard = true; });
    const warn = vi.spyOn(console, 'warn');
    unlockAudio();                                      // inside the button's onClick
    expect(heard && isAudioUnlocked()).toBe(true);
    expect(spoken).toEqual(['memory_incident']);        // safety first; greeting waits for it to end
    expect(apis.counts.synthSpeak).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('nothing in the voice or replay sources starts sound at import time', () => {
    // speak()/play()/new Audio/new Utterance only ever appear inside functions in speaker.js
    const src = readFileSync(fileURLToPath(new URL('./speaker.js', import.meta.url)), 'utf8');
    const topLevel = src.split('\n').filter((l) => /^\S/.test(l) && !l.startsWith('//')).join('\n');
    expect(topLevel).not.toMatch(/\.speak\(|\.play\(|new Audio|new Utterance/);
  });
});
