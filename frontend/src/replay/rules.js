// Replay events -> SaathiEvents {priority, mode, message_key, slots, lang}.
//
//   resume_after_idle while unbelted     -> safety / alert   belt_before_move
//   seatbelt unfastened while active     -> safety / alert   seatbelt_unfastened (unless belt_before_move just fired)
//   safety_alert with proximity          -> safety / alert   proximity_alert {distance_m}
//   safety_alert without proximity       -> safety / alert   safety_alert
//   idle stretch reaches N minutes       -> coaching / friendly  <recommended lesson>, once per stretch

import { detectEvents } from './player.js';

export const IDLE_LESSON_MIN = 10;
export const DEFAULT_LESSON = 'lesson_idle_engine_off';

export function createRules({ lang = 'en', lessonKey = DEFAULT_LESSON, idleLessonMin = IDLE_LESSON_MIN } = {}) {
  let lessonPlayed = false;
  let beltWarnedAt = -1;
  const say = (priority, mode, message_key, slots = {}) => ({ priority, mode, message_key, slots, lang });

  return function toSaathiEvents(event) {
    switch (event.type) {
      case 'tick':
        if (event.idle && event.idle_minutes >= idleLessonMin && !lessonPlayed) {
          lessonPlayed = true;
          return [say('coaching', 'friendly', lessonKey)];
        }
        return [];
      case 'idle_end':
        lessonPlayed = false;
        return [];
      case 'resume_after_idle':
        if (event.seatbelt_status === 'Unfastened') {
          beltWarnedAt = event.index;
          return [say('safety', 'alert', 'belt_before_move')];
        }
        return [];
      case 'seatbelt_change':
        if (event.to === 'Unfastened' && event.machine_active && beltWarnedAt !== event.index) {
          return [say('safety', 'alert', 'seatbelt_unfastened')];
        }
        return [];
      case 'safety_alert':
        if (typeof event.proximity_distance_m === 'number') {
          return [say('safety', 'alert', 'proximity_alert', { distance_m: event.proximity_distance_m })];
        }
        return [say('safety', 'alert', 'safety_alert')];
      default:
        return [];
    }
  };
}

// Run a scenario instantly and return the ordered SaathiEvents (used by tests and headless runs).

export function scenarioToSaathiEvents(windows, options = {}) {
  const rules = createRules(options);
  return detectEvents(windows, options).flat().flatMap((e) => rules(e));
}
