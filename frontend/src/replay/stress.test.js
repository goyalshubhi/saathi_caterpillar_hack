// Fast-forward stress: replay at 60x (and 600x) on a simulated clock where every spoken line takes
// real time, so replay events arrive while lines are still playing. Queue ordering and budget
// logic must not depend on the gaps between events.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connectReplay } from './index.js';
import { createQueue } from '../voice/queue.js';
import { unlockAudio } from '../voice/unlock.js';

unlockAudio(); // these tests start after the Start button's click (see unlock.test.js for before it)

const demo = JSON.parse(readFileSync(fileURLToPath(new URL('../../../contracts/examples/demo_scenario.json', import.meta.url)), 'utf8'));

// Simulated clock: timers run in due-time order (ties in creation order).
function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  return {
    get now() { return now; },
    setTimer(fn, ms) { const id = ++seq; timers.set(id, { fn, at: now + ms, id }); return id; },
    clearTimer(id) { timers.delete(id); },
    runUntilIdle(limit = 100000) {
      for (let i = 0; i < limit && timers.size; i += 1) {
        const next = [...timers.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0];
        timers.delete(next.id);
        now = next.at;
        next.fn();
      }
    },
  };
}

// Speaker whose lines take `durationMs` on the fake clock; records overlaps and interruptions.
function timedSpeaker(clock, durationMs = (e) => (e.priority === 'safety' ? 4000 : 6000)) {
  const log = [];
  let active = null;
  let maxConcurrent = 0;
  return {
    log,
    get maxConcurrent() { return maxConcurrent; },
    speak(event, { onEnd } = {}) {
      const entry = { key: event.message_key, priority: event.priority, start: clock.now, end: null, interrupted: false };
      log.push(entry);
      maxConcurrent = Math.max(maxConcurrent, active && active.end === null ? 2 : 1);
      active = entry;
      entry.timer = clock.setTimer(() => { entry.end = clock.now; if (active === entry) active = null; onEnd?.(); }, durationMs(event));
      return { text: event.message_key, lang: event.lang, source: 'audio' };
    },
    cancel() {
      if (active && active.end === null) {
        clock.clearTimer(active.timer);
        active.end = clock.now;
        active.interrupted = true;
        active = null;
      }
    },
  };
}

const win = (i, over = {}) => ({
  timestamp: `2025-05-03 ${String(8 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:00`,
  machine_id: 'EXC001', operator_id: 'OP1001', engine_hours: 1600 + i / 4, fuel_used_l: 1.2, load_cycles: 3,
  idling_time_min: 2, seatbelt_status: 'Fastened', safety_alert_triggered: 'No', proximity_distance_m: 18,
  machine_active: true, ...over,
});

// Worst case: three idle stretches (each could trigger a lesson), unbelted resumes, and
// back-to-back proximity alerts, including one in the same window as a resume.
const idle = (i, belt = 'Fastened') => win(i, { machine_active: false, idling_time_min: 14, load_cycles: 0, seatbelt_status: belt });
const STRESS = {
  name: 'stress', task_id: 'T101',
  windows: [
    win(0), idle(1), idle(2, 'Unfastened'),
    win(3, { seatbelt_status: 'Unfastened', safety_alert_triggered: 'Yes', proximity_distance_m: 2.1 }),
    win(4, { safety_alert_triggered: 'Yes', proximity_distance_m: 1.8 }),
    win(5, { safety_alert_triggered: 'Yes', proximity_distance_m: 2.4 }),
    idle(6), idle(7, 'Unfastened'), win(8, { seatbelt_status: 'Unfastened' }),
    win(9), idle(10), idle(11), win(12, { safety_alert_triggered: 'Yes', proximity_distance_m: 1.5 }), win(13),
  ],
};

function run(scenario, speed, lessonMs = 6000) {
  const clock = fakeClock();
  const speaker = timedSpeaker(clock, (e) => (e.priority === 'safety' ? 4000 : lessonMs));
  const queue = createQueue({ speaker });
  const pushed = [];
  const player = connectReplay(scenario, {
    queue, lang: 'en', speed, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    onEvent: () => {},
  });
  const push = queue.push;
  queue.push = (e) => { pushed.push(e.message_key); return push(e); };
  player.play();
  clock.runUntilIdle();
  return { speaker, queue, player, pushed };
}

describe('replay at speed', () => {
  for (const speed of [60, 600]) {
    describe(`${speed}x`, () => {
      it('(a) at most one coaching line per task, even with many idle stretches', () => {
        const { speaker, player } = run(STRESS, speed);
        expect(player.done).toBe(true);
        expect(speaker.log.filter((l) => l.priority === 'coaching')).toHaveLength(1);
      });

      it('(b) safety preempts in-progress coaching instead of queueing behind it', () => {
        // lesson long enough that the first safety event lands while it is still playing
        // (60x: windows every 15 s, so a 40 s lesson; 600x: every 1.5 s, so the normal 6 s)
        const { speaker } = run(STRESS, speed, speed === 60 ? 40000 : 6000);
        const lesson = speaker.log.find((l) => l.priority === 'coaching');
        const firstSafety = speaker.log.find((l) => l.priority === 'safety');
        expect(firstSafety.start).toBeLessThan(lesson.start + (speed === 60 ? 40000 : 6000));
        expect(lesson.interrupted).toBe(true);
        expect(lesson.end).toBe(firstSafety.start);             // cut off the moment safety arrives
        // no safety line ever waits for a coaching line to finish
        for (const s of speaker.log.filter((l) => l.priority === 'safety')) {
          const coachingPlaying = speaker.log.some((l) => l.priority === 'coaching' && l.start < s.start && l.end > s.start);
          expect(coachingPlaying).toBe(false);
        }
      });

      it('(c) safety lines never overlap: each plays in full, in arrival order', () => {
        const { speaker, pushed } = run(STRESS, speed);
        expect(speaker.maxConcurrent).toBe(1);
        const safety = speaker.log.filter((l) => l.priority === 'safety');
        expect(safety.every((l) => !l.interrupted && l.end - l.start === 4000)).toBe(true);
        for (let i = 1; i < safety.length; i += 1) expect(safety[i].start).toBeGreaterThanOrEqual(safety[i - 1].end);
        expect(safety.map((l) => l.key)).toEqual(pushed.filter((k) => !k.startsWith('lesson')));
      });
    });
  }

  it('speed does not change what is said: 1x, 60x, 600x and instant speak the same safety lines', () => {
    const safetyKeys = (speed) => run(STRESS, speed).speaker.log.filter((l) => l.priority === 'safety').map((l) => l.key);
    const expected = safetyKeys(Infinity);
    expect(expected.length).toBeGreaterThanOrEqual(6);
    for (const speed of [1, 60, 600]) expect(safetyKeys(speed)).toEqual(expected);
  });

  it('the real demo scenario at 60x speaks the scripted lines with no overlap', () => {
    const { speaker } = run(demo, 60);
    expect(speaker.maxConcurrent).toBe(1);
    expect(speaker.log.map((l) => l.key)).toEqual(
      ['lesson_idle_engine_off', 'belt_before_move', 'proximity_alert', 'seatbelt_unfastened', 'seatbelt_unfastened']);
  });
});
