import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectEvents, createPlayer } from './player.js';
import { BELT_MIN_IDLE_MIN, createRules, scenarioToSaathiEvents, spokenDistance } from './rules.js';
import { connectReplay } from './index.js';
import { createQueue } from '../voice/queue.js';
import { hasTemplate, render } from '../voice/templates.js';
import { unlockAudio } from '../voice/unlock.js';

unlockAudio(); // these tests start after the Start button's click (see unlock.test.js for before it)

const loadExample = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../contracts/examples/${name}`, import.meta.url)), 'utf8'));

const fixture = loadExample('scenario_demo.json');

const win = (over = {}) => ({
  timestamp: '2026-09-23T08:00:00', machine_id: 'EXC001', operator_id: 'OP1001', engine_hours: 1600,
  fuel_used_l: 2.5, load_cycles: 9, idling_time_min: 1, seatbelt_status: 'Fastened',
  safety_alert_triggered: 'No', proximity_distance_m: null, machine_active: true, ...over,
});

const types = (groups) => groups.flat().filter((e) => e.type !== 'tick').map((e) => `${e.index}:${e.type}`);

describe('detectEvents', () => {
  it('produces the expected event sequence for the fixture scenario', () => {
    expect(types(detectEvents(fixture.windows))).toEqual([
      '2:idle_start', '2:seatbelt_change',
      '4:idle_end', '4:resume_after_idle',
      '5:seatbelt_change',
      '6:safety_alert',
    ]);
  });

  it('emits one tick per window, first in each group', () => {
    const groups = detectEvents(fixture.windows);
    expect(groups).toHaveLength(fixture.windows.length);
    groups.forEach((g, i) => expect(g[0]).toMatchObject({ type: 'tick', index: i }));
  });

  it('tracks idle minutes across an idle stretch', () => {
    const groups = detectEvents(fixture.windows);
    expect(groups[3][0]).toMatchObject({ idle: true, idle_minutes: 30 });
    expect(groups[4].find((e) => e.type === 'resume_after_idle')).toMatchObject({ idle_minutes: 30, seatbelt_status: 'Unfastened' });
  });

  it('treats an active window with heavy idling as idle', () => {
    const g = detectEvents([win(), win({ idling_time_min: 12 }), win()]);
    expect(types(g)).toEqual(['1:idle_start', '2:idle_end', '2:resume_after_idle']);
  });
});

describe('rules', () => {
  it('turns the fixture scenario into the expected SaathiEvents in order', () => {
    expect(scenarioToSaathiEvents(fixture.windows, { lang: 'hi' })).toEqual([
      { priority: 'coaching', mode: 'friendly', message_key: 'lesson_idle_engine_off', slots: {}, lang: 'hi' },
      { priority: 'safety', mode: 'alert', message_key: 'belt_before_move', slots: {}, lang: 'hi' },
      { priority: 'safety', mode: 'alert', message_key: 'proximity_alert', slots: { distance_m: 2 }, lang: 'hi' },
    ]);
  });

  it('warns when the belt comes off while working', () => {
    const out = scenarioToSaathiEvents([win(), win({ seatbelt_status: 'Unfastened' })]);
    expect(out.map((e) => e.message_key)).toEqual(['seatbelt_unfastened']);
  });

  it('does not warn about the belt while idle, and not on belted resume', () => {
    const out = scenarioToSaathiEvents([
      win(), win({ machine_active: false, idling_time_min: 5, seatbelt_status: 'Unfastened' }),
      win({ seatbelt_status: 'Fastened' }),
    ]);
    expect(out).toEqual([]);
  });

  // A stop, unbuckling during it, then work resumes unbelted.
  const unbeltedResume = (idleMin) => [
    win(), win({ machine_active: false, idling_time_min: idleMin, seatbelt_status: 'Unfastened' }),
    win({ seatbelt_status: 'Unfastened' }),
  ];

  it('a short pause then unbelted resume does not fire belt_before_move', () => {
    expect(BELT_MIN_IDLE_MIN).toBe(2);
    const out = scenarioToSaathiEvents(unbeltedResume(1));
    expect(out.map((e) => e.message_key)).not.toContain('belt_before_move');
    // still working unbelted, so the ordinary seatbelt line is spoken once (never silence)
    expect(out.map((e) => e.message_key)).toEqual(['seatbelt_unfastened']);
  });

  it('a long stop then unbelted resume still fires belt_before_move (threshold inclusive)', () => {
    for (const idleMin of [BELT_MIN_IDLE_MIN, 12]) {
      const safety = scenarioToSaathiEvents(unbeltedResume(idleMin)).filter((e) => e.priority === 'safety');
      expect(safety.map((e) => e.message_key)).toEqual(['belt_before_move']);
    }
  });

  it('the belt threshold can be tuned per run', () => {
    const out = scenarioToSaathiEvents(unbeltedResume(5), { beltMinIdleMin: 10 });
    expect(out.map((e) => e.message_key)).toEqual(['seatbelt_unfastened']);
  });

  it('the demo scenario still fires belt_before_move at the same window', () => {
    const rules = createRules({ lang: 'en' });
    const fired = detectEvents(fixture.windows).flat()
      .flatMap((e) => rules(e).map((s) => ({ key: s.message_key, index: e.index })))
      .filter((x) => x.key === 'belt_before_move');
    expect(fired).toEqual([{ key: 'belt_before_move', index: 4 }]);
    const demo = loadExample('demo_scenario.json');
    const r = createRules({ lang: 'en' });
    const demoFired = detectEvents(demo.windows).flat()
      .flatMap((e) => r(e).map((s) => ({ key: s.message_key, ts: e.timestamp })))
      .filter((x) => x.key === 'belt_before_move');
    expect(demoFired).toEqual([{ key: 'belt_before_move', ts: '2025-05-03 09:15:00' }]);
  });

  it('speaks proximity in whole metres, rounded down, at least 1', () => {
    expect([2.1, 2.5, 2.99, 3, 0.4, 17.8].map(spokenDistance)).toEqual([2, 2, 2, 3, 1, 17]);
    const out = scenarioToSaathiEvents([win({ safety_alert_triggered: 'Yes', proximity_distance_m: 2.7 })]);
    expect(out[0].slots).toEqual({ distance_m: 2 });
  });

  it('safety alert without proximity uses the generic line', () => {
    const out = scenarioToSaathiEvents([win({ safety_alert_triggered: 'Yes' })]);
    expect(out.map((e) => e.message_key)).toEqual(['safety_alert']);
  });

  it('plays at most one lesson per idle stretch and uses the recommended lesson', () => {
    const idle = win({ machine_active: false, idling_time_min: 15 });
    const out = scenarioToSaathiEvents([idle, idle, idle, win(), idle, idle], { lessonKey: 'lesson_walkaround' });
    expect(out.map((e) => e.message_key)).toEqual(['lesson_walkaround', 'lesson_walkaround']);
  });

  it('only emits keys that exist in templates', () => {
    const rules = createRules();
    const events = detectEvents(fixture.windows).flat();
    for (const s of events.flatMap((e) => rules(e))) {
      expect(hasTemplate(s.message_key)).toBe(true);
      expect(render(s.message_key, s.slots, 'hi')).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('player', () => {
  it('runs instantly with speed Infinity', () => {
    const seen = [];
    const done = [];
    const p = createPlayer(fixture.windows, { speed: Infinity, onEvent: (e) => seen.push(e.type), onDone: () => done.push(1) });
    p.play();
    expect(p.done).toBe(true);
    expect(done).toEqual([1]);
    expect(seen.filter((t) => t === 'tick')).toHaveLength(fixture.windows.length);
  });

  it('scales window spacing by speed and can pause', () => {
    const timers = [];
    const setTimer = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    const cleared = [];
    const p = createPlayer(fixture.windows, { speed: 60, setTimer, clearTimer: (id) => cleared.push(id) });
    p.play();
    timers.shift().fn(); // first window plays at once
    expect(p.index).toBe(1);
    expect(timers[0].ms).toBe(15000); // 15 min / 60
    p.setSpeed(10);
    expect(timers[timers.length - 1].ms).toBe(90000);
    p.pause();
    expect(cleared.length).toBeGreaterThan(0);
  });
});

describe('replay -> queue', () => {
  it('safety lines preempt the idle lesson while it is still speaking', () => {
    const calls = [];
    let cancels = 0;
    const speaker = {
      speak(e) { calls.push(e.message_key); return {}; }, // never finishes on its own
      cancel() { cancels += 1; },
    };
    const queue = createQueue({ speaker });
    connectReplay(fixture, { queue, lang: 'hi' }).runAll();
    expect(calls).toEqual(['lesson_idle_engine_off', 'belt_before_move']);
    expect(cancels).toBe(1);
    expect(queue.pending.map((e) => e.message_key)).toEqual(['proximity_alert']);
  });
});
