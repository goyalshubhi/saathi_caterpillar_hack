// Speak a screen's lines once when it opens (and its data is ready), in order.
// `id` names the briefing (e.g. "morning@2"): each id is spoken once, so revisiting a screen stays quiet.
// It is marked as spoken only when its first line is queued, so an effect that is cleaned up
// straight away (React StrictMode) does not swallow it.
import { useEffect } from 'react';
import { store } from '../state/store.js';
import { sayInOrder } from './voiceRuntime.js';

export function useBriefing(id, buildEvents, ready) {
  useEffect(() => {
    if (!ready || !id || store.get().briefed[id]) return undefined;
    let alive = true;
    const events = buildEvents();
    const isAlive = () => {
      if (!alive) return false;
      if (!store.get().briefed[id]) store.set((s) => ({ briefed: { ...s.briefed, [id]: true } }));
      return true;
    };
    sayInOrder(events, { alive: isAlive }).then(() => {
      if (alive) store.set((s) => ({ spokeOn: { screen: id, n: s.spokeOn.n + 1 } }));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);
}
