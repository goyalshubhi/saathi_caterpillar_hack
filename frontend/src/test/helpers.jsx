// Test helpers: fixture data, a silent speaker and the app shell at a given route.
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createSpeaker } from '../voice/index.js';
import { store } from '../state/store.js';
import { forceMode } from '../api.js';
import { configureVoice } from '../saathi/voiceRuntime.js';
import { stopReplay } from '../saathi/replayRuntime.js';
import { stopDemo } from '../demo/demo.js';
import { Shell } from '../App.jsx';

// Records what was spoken; every line ends immediately.
export function fakeSpeaker() {
  const said = [];
  const speaker = createSpeaker({ synth: null, Utterance: null, Audio: null });
  return {
    said,
    speak(event, opts) {
      said.push(event);
      return speaker.speak(event, opts);
    },
    cancel() {},
    get available() { return false; },
    get fallbackToEnglish() { return false; },
  };
}

export function resetApp(overrides = {}) {
  stopDemo();
  stopReplay();
  forceMode('fixture');
  store.reset({ unlocked: true, apiMode: 'fixture', ...overrides });
  const speaker = fakeSpeaker();
  configureVoice({ speaker });
  return speaker;
}

export function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Shell />
    </MemoryRouter>,
  );
}
