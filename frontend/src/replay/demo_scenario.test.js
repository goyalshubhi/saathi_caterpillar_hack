// Integration: the real "demo" scenario (exported from the API by scripts/export_scenario.py)
// through replay -> rules -> voice queue must produce the scripted SaathiEvents in order.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connectReplay } from './index.js';
import { createQueue } from '../voice/queue.js';
import { createSpeaker } from '../voice/speaker.js';
import { createPhraser, DEMO_SEED } from '../voice/phrasing.js';

const demo = JSON.parse(readFileSync(fileURLToPath(new URL('../../../contracts/examples/demo_scenario.json', import.meta.url)), 'utf8'));

const EXPECTED = [
  { priority: 'coaching', mode: 'friendly', message_key: 'lesson_idle_engine_off', slots: {} },
  { priority: 'safety', mode: 'alert', message_key: 'belt_before_move', slots: {} },
  { priority: 'safety', mode: 'alert', message_key: 'proximity_alert', slots: { distance_m: 2.1 } },
  { priority: 'safety', mode: 'alert', message_key: 'seatbelt_unfastened', slots: {} },
  { priority: 'safety', mode: 'alert', message_key: 'seatbelt_unfastened', slots: {} },
];

// Fake speech API with a Hindi voice; every utterance finishes immediately.
const instantSpeaker = () => createSpeaker({
  synth: { getVoices: () => [{ lang: 'hi-IN' }, { lang: 'en-IN' }], speak: (u) => u.onend(), cancel: () => {} },
  Utterance: class { constructor(text) { this.text = text; } },
});

describe('real demo scenario -> replay -> queue', () => {
  it('is the scripted demo for task T101', () => {
    expect(demo.name).toBe('demo');
    expect(demo.task_id).toBe('T101');
    expect(demo.windows.length).toBeGreaterThan(8);
  });

  it('speaks the expected SaathiEvents in order (Hindi)', () => {
    const queue = createQueue({ speaker: instantSpeaker(), phraser: createPhraser({ seed: DEMO_SEED }) });
    connectReplay(demo, { queue, lang: 'hi' }).runAll();
    const spoken = queue.spoken;
    expect(spoken.map(({ event: { variant, ...rest } }) => rest)).toEqual(EXPECTED.map((e) => ({ ...e, lang: 'hi' })));
    // safety lines always use their single phrasing; the lesson's phrasing is fixed by the demo seed
    expect(spoken.slice(1).every((s) => s.event.variant === 0)).toBe(true);
    expect(spoken[1].text).toContain('बेल्ट');
    expect(spoken[2].text).toContain('2.1');
  });

  it('quiet mode keeps every safety line but drops the lesson', () => {
    const queue = createQueue({ speaker: instantSpeaker() });
    queue.setQuiet(true);
    connectReplay(demo, { queue, lang: 'en' }).runAll();
    expect(queue.spoken.map((s) => s.event.message_key)).toEqual(EXPECTED.slice(1).map((e) => e.message_key));
  });
});
