// Unlock gate + quiet mode: coaching accepted before the Start click, then silenced by quiet mode
// while it waited, must not play once the click unlocks audio. Safety still plays.
// Own file: the unlock flag is per module instance, and this session starts locked.
import { describe, it, expect } from 'vitest';
import { createQueue } from './queue.js';
import { unlockAudio, isAudioUnlocked } from './unlock.js';

describe('quiet mode while lines wait for the unlock', () => {
  it('drops waiting coaching, keeps safety', () => {
    expect(isAudioUnlocked()).toBe(false);
    const said = [];
    const speaker = { speak: (e, { onEnd } = {}) => { said.push(e.message_key); onEnd?.(); return { text: e.message_key, lang: 'en', source: 'audio' }; }, cancel() {} };
    const queue = createQueue({ speaker });
    queue.push({ priority: 'coaching', mode: 'coach', message_key: 'lesson_idle_engine_off', slots: {}, lang: 'en' });
    queue.push({ priority: 'safety', mode: 'alert', message_key: 'belt_before_move', slots: {}, lang: 'en' });
    queue.setQuiet(true);
    expect(queue.pending.map((e) => e.message_key)).toEqual(['belt_before_move']);

    unlockAudio();
    expect(said).toEqual(['belt_before_move']);
  });
});
