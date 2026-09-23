// Saathi telemetry replay (M8). UI-free ES modules: a React app can import these later.
import { createPlayer } from './player.js';
import { createRules } from './rules.js';

export { detectEvents, createPlayer, isIdleWindow, WINDOW_SECONDS, DEFAULT_IDLE_THRESHOLD_MIN } from './player.js';
export { createRules, scenarioToSaathiEvents, IDLE_LESSON_MIN, DEFAULT_LESSON } from './rules.js';

// Wire a player to the voice queue: replay events -> rules -> queue.push.

export function connectReplay(scenario, { queue, lang = 'en', lessonKey, speed = Infinity, onEvent = () => {}, ...playerOptions } = {}) {
  const rules = createRules({ lang, lessonKey });
  queue.startTask(scenario.task_id);
  return createPlayer(scenario.windows, {
    speed,
    ...playerOptions,
    onEvent(e) {
      onEvent(e);
      rules(e).forEach((s) => queue.push(s));
    },
  });
}
