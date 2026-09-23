// Briefing builders, lessons and the voice runtime (no DOM).
import { describe, it, expect, beforeEach } from 'vitest';
import { fixture } from '../fixtures.js';
import { morningEvents, pretaskEvents, debriefEvents, debriefSplit } from './briefings.js';
import { recommendedLessons } from './lessons.js';
import { configureVoice, say, sayInOrder, whenIdle, setQuiet, triggerLines } from './voiceRuntime.js';
import { store } from '../state/store.js';
import { hasTemplate, createSpeaker } from '../voice/index.js';

const tasks = fixture('tasksToday');
const plan = fixture('dayPlan');
const weather = fixture('weatherToday');
const pred = fixture('prediction');

describe('briefings', () => {
  it('morning briefing mirrors the headless demo order and uses only known keys', () => {
    const memory = [fixture('memoryNote')];
    const ev = morningEvents({ tasks, weather, plan, predictions: { T101: pred }, memory, machine: 'EXC001' });
    expect(ev.map((e) => e.message_key)).toEqual(['shift_hello', 'memory_incident', 'greeting', 'task_card', 'task_card', 'task_card', 'rain_today', 'heat_today', 'plan_order', 'breaks_planned']);
    expect(ev[1]).toMatchObject({ priority: 'safety', mode: 'alert' });
    expect(ev[3].slots).toEqual({ n: 1, task_type: 'Trenching', predicted_min: 52 });
    expect(ev.every((e) => hasTemplate(e.message_key))).toBe(true);
  });

  it('pre-task: estimate then the task\'s safety warnings', () => {
    const ev = pretaskEvents({ task: tasks[0], prediction: pred, plan });
    expect(ev.map((e) => e.message_key)).toEqual(['pretask_estimate', 'warn.rain_slippery', 'warn.rain_trench_edge']);
    expect(ev[0].slots).toMatchObject({ cat_min: 45, predicted_min: 52 });
  });

  it('debrief: "9 minutes over — 6 + 3", not your fault, then findings', () => {
    const d = fixture('debrief');
    expect(debriefSplit(d)).toEqual({ over: 9, uncontrollable: 6, controllable: 3 });
    const ev = debriefEvents(d, fixture('findings'));
    expect(ev[0].slots).toMatchObject({ over_min: 9, uncontrollable_min: 6, controllable_min: 3, factors: ['weather', 'machine_age'] });
    expect(ev.map((e) => e.message_key).slice(0, 2)).toEqual(['debrief_over', 'debrief_not_your_fault']);
    expect(debriefEvents({ ...d, uncontrollable_min: 0, controllable_min: 0 })[0].message_key).toBe('debrief_on_time');
  });

  it('recommends lessons from findings, then conditions', () => {
    expect(recommendedLessons({ findings: fixture('findings'), weather, tasks })).toEqual(['lesson_idle_engine_off', 'lesson_smooth_cycles', 'lesson_walkaround', 'lesson_trench_edge', 'lesson_hydration']);
  });
});

describe('voice runtime', () => {
  let said;
  beforeEach(() => {
    store.reset({ unlocked: true }); // after the Start click (the gate itself is tested in screens.test.jsx)
    said = [];
    const inner = createSpeaker({ synth: null, Utterance: null, Audio: null });
    configureVoice({ speaker: { ...inner, speak: (e, o) => { said.push(e); return inner.speak(e, o); }, cancel() {}, fallbackToEnglish: false } });
  });

  it('logs spoken lines with their phrasing and sets the caption', () => {
    say({ priority: 'info', mode: 'friendly', message_key: 'rain_today' });
    const [entry] = store.get().log.queue;
    expect(entry.decision).toBe('spoken');
    expect(entry.variant).toBeGreaterThanOrEqual(0);
    expect(store.get().caption.text).toMatch(/rain/i);
  });

  it('logs the second coaching line as held (budget)', () => {
    say({ priority: 'coaching', mode: 'friendly', message_key: 'lesson_hydration' });
    const r = say({ priority: 'coaching', mode: 'friendly', message_key: 'lesson_walkaround' });
    expect(r).toEqual({ accepted: false, reason: 'budget' });
    expect(store.get().log.queue[0].decision).toBe('held-budget');
  });

  it('sayInOrder speaks every line in order', async () => {
    await sayInOrder([{ priority: 'info', mode: 'friendly', message_key: 'greeting', slots: { count: 3 } }, { priority: 'safety', mode: 'alert', message_key: 'safety_alert' }]);
    await whenIdle();
    expect(said.map((e) => e.message_key)).toEqual(['greeting', 'safety_alert']);
  });

  it('shows the safety banner for safety alerts only', () => {
    say({ priority: 'info', mode: 'friendly', message_key: 'rain_today' });
    expect(store.get().safety).toBeNull();
    say({ priority: 'safety', mode: 'alert', message_key: 'belt_before_move' });
    expect(store.get().safety.key).toBe('belt_before_move');
  });
});

describe('trigger lines (no playlists)', () => {
  it('a screen opens with its headline line plus safety lines only', () => {
    const memory = [fixture('memoryNote')];
    const ev = morningEvents({ tasks, weather, plan, predictions: { T101: pred }, memory, machine: 'EXC001' });
    expect(triggerLines(ev).map((e) => e.message_key)).toEqual(['memory_incident', 'greeting']);
    expect(triggerLines(pretaskEvents({ task: tasks[0], prediction: pred, plan })).map((e) => e.message_key))
      .toEqual(['pretask_estimate', 'warn.rain_slippery', 'warn.rain_trench_edge']);
    expect(triggerLines(debriefEvents(fixture('debrief'), fixture('findings'))).map((e) => e.message_key)).toEqual(['debrief_over']);
  });
});

describe('coaching mute', () => {
  let said;
  let cancels;
  beforeEach(() => {
    store.reset({ unlocked: true }); // after the Start click
    said = [];
    cancels = 0;
    // Lines keep "playing" until cancelled.
    configureVoice({ speaker: {
      speak(e) { said.push(e.message_key); return { text: e.message_key, lang: 'en', source: 'audio' }; },
      cancel() { cancels += 1; },
      fallbackToEnglish: false,
    } });
  });

  it('holds every non-safety line but still speaks safety', () => {
    setQuiet(true);
    expect(say({ priority: 'info', mode: 'friendly', message_key: 'rain_today' })).toEqual({ accepted: false, reason: 'quiet' });
    expect(say({ priority: 'care', mode: 'care', message_key: 'break_time' }).accepted).toBe(false);
    expect(say({ priority: 'safety', mode: 'alert', message_key: 'belt_before_move' }).accepted).toBe(true);
    expect(said).toEqual(['belt_before_move']);
  });

  it('turning mute on stops the line that is playing and skips what was queued', () => {
    say({ priority: 'info', mode: 'friendly', message_key: 'rain_today' });
    say({ priority: 'info', mode: 'friendly', message_key: 'greeting', slots: { count: 3 } });
    expect(store.get().speaking.event.message_key).toBe('rain_today');
    setQuiet(true);
    expect(cancels).toBe(1);
    expect(store.get().speaking).toBeNull();
    expect(store.get().caption).toBeNull();
    expect(said).toEqual(['rain_today']); // greeting was queued, then skipped
    expect(store.get().log.queue.map((l) => l.decision)).toContain('muted');
  });

  it('does not cut a safety line', () => {
    say({ priority: 'safety', mode: 'alert', message_key: 'belt_before_move' });
    setQuiet(true);
    expect(cancels).toBe(0);
    expect(store.get().speaking.event.message_key).toBe('belt_before_move');
  });
});
