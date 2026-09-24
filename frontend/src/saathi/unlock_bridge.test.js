// The app's unlock (store.unlocked: the "Start Saathi" click, remembered per tab session) drives the
// voice engine's own gate (src/voice/unlock.js). Each test loads fresh modules, so the engine gate
// starts closed, like a fresh page load.
import { describe, it, expect, vi } from 'vitest';

async function freshApp() {
  vi.resetModules();
  const runtime = await import('./voiceRuntime.js');
  const { store } = await import('../state/store.js');
  const { isAudioUnlocked } = await import('../voice/index.js');
  return { ...runtime, store, isAudioUnlocked };
}

function fakeSpeaker(said) {
  return {
    speak(e, { onEnd } = {}) { said.push(e.message_key); onEnd?.(); return { text: e.message_key, lang: 'en', source: 'audio' }; },
    cancel() {},
    fallbackToEnglish: false,
  };
}

const LINE = { priority: 'info', mode: 'friendly', message_key: 'greeting', slots: { count: 3 } };

describe('app unlock -> engine gate', () => {
  it('nothing plays before the Start click; the click opens both gates and plays what waited', async () => {
    const app = await freshApp();
    app.store.reset({ unlocked: false });
    const said = [];
    app.configureVoice({ speaker: fakeSpeaker(said) });
    app.say(LINE);
    expect(said).toEqual([]);
    expect(app.isAudioUnlocked()).toBe(false);

    app.unlockAudio(); // the "Start Saathi" click
    expect(app.isAudioUnlocked()).toBe(true);
    expect(said).toEqual(['greeting']);
  });

  it('a reload in a tab that was already unlocked speaks without a new click (no deadlock)', async () => {
    const app = await freshApp();
    app.store.reset({ unlocked: true }); // remembered for the tab session, so no Start overlay
    const said = [];
    app.configureVoice({ speaker: fakeSpeaker(said) });
    expect(app.isAudioUnlocked()).toBe(false);
    app.say(LINE);
    expect(said).toEqual(['greeting']);
    expect(app.isAudioUnlocked()).toBe(true);
  });
});
