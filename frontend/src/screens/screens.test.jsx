// @vitest-environment jsdom
// Every operator screen renders with fixture data (API in FIXTURE mode) and speaks what it should.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resetApp, renderAt } from '../test/helpers.jsx';
import { store, initialState, patchDemo, UNLOCK_KEY } from '../state/store.js';
import { say, setQuiet, configureVoice } from '../saathi/voiceRuntime.js';
import { StartOverlay } from '../components/Overlays.jsx';
import Morning from './Morning.jsx';

let speaker;
beforeEach(() => {
  speaker = resetApp();
});

describe('Morning', () => {
  it('shows task cards in plan order with Saathi vs CAT numbers, conditions, breaks and memory', async () => {
    renderAt('/morning');
    expect(await screen.findByTestId('task-card-T101')).toBeTruthy();
    const cards = screen.getAllByTestId(/^task-card-/).map((c) => c.dataset.testid);
    expect(cards).toEqual(['task-card-T101', 'task-card-T102', 'task-card-T103']);
    const t101 = screen.getByTestId('task-card-T101');
    expect(within(t101).getByText('Trenching')).toBeTruthy();
    await waitFor(() => expect(t101.querySelector('[data-value="52"]')).toBeTruthy());
    expect(within(t101).getByText('45')).toBeTruthy();
    expect(screen.getByTestId('conditions')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByTestId('memory-card').textContent).toMatch(/No notes/);
    expect(screen.getByTestId('avatar')).toBeTruthy();
  });

  it('opening Morning speaks one point (the greeting), not a playlist of the whole screen', async () => {
    renderAt('/morning');
    await waitFor(() => expect(speaker.said.some((e) => e.message_key === 'greeting')).toBe(true));
    await new Promise((r) => setTimeout(r, 300));
    expect(speaker.said.map((e) => e.message_key)).toEqual(['greeting']);
    expect(screen.getByTestId('task-card-T101')).toBeTruthy();          // the rest is on screen
  });

  it('switches labels to Hindi', async () => {
    renderAt('/morning');
    await screen.findByTestId('task-card-T101');
    fireEvent.click(screen.getByTestId('lang-toggle'));
    expect(await screen.findByText('सुप्रभात')).toBeTruthy();
    expect(screen.getByText('खाई की खुदाई')).toBeTruthy();
  });
});

describe('Pre-task', () => {
  it('shows CAT estimate vs Saathi prediction, factor bars and the rain warnings, all spoken', async () => {
    renderAt('/pretask/T101');
    const pred = await screen.findByTestId('saathi-prediction');
    await waitFor(() => expect(pred.querySelector('[data-value="52"]')).toBeTruthy());
    expect(screen.getByTestId('factor-bars').textContent).toMatch(/Weather/);
    const warnings = screen.getByLabelText('Safety for this task');
    expect(within(warnings).getByText(/slippery after rain/)).toBeTruthy();
    expect(within(warnings).getByText(/2 metres back from the trench edge/)).toBeTruthy();
    await waitFor(() => expect(speaker.said.map((e) => e.message_key)).toEqual(['pretask_estimate', 'warn.rain_slippery', 'warn.rain_trench_edge']));
  });
});

describe('In-task', () => {
  it('hides the avatar, shows the status chip, machine state, progress and three incident buttons', async () => {
    renderAt('/intask/T101');
    expect(await screen.findByTestId('screen-intask')).toBeTruthy();
    expect(screen.queryByTestId('avatar')).toBeNull();
    expect(screen.getByTestId('saathi-chip').textContent).toMatch(/Saathi\s*ready/);   // not "Listening" when idle
    expect(screen.getByTestId('machine-state')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    for (const c of ['near_miss', 'person_in_zone', 'machine_issue']) expect(screen.getByTestId(`incident-${c}`)).toBeTruthy();
  });

  it('shows the red safety banner when a safety SaathiEvent is emitted', async () => {
    renderAt('/intask/T101');
    await screen.findByTestId('screen-intask');
    expect(screen.queryByTestId('safety-banner')).toBeNull();
    act(() => { say({ priority: 'safety', mode: 'alert', message_key: 'proximity_alert', slots: { distance_m: 2.5 } }); });
    const banner = await screen.findByTestId('safety-banner');
    expect(banner.textContent).toMatch(/2\.5 metres/);
  });
});

describe('Debrief', () => {
  it('splits the overrun into two segments that sum to it, and shows finding cards', async () => {
    renderAt('/debrief/T101');
    const bar = await screen.findByTestId('overrun-bar');
    const u = Number(screen.getByTestId('seg-uncontrollable').dataset.minutes);
    const c = Number(screen.getByTestId('seg-controllable').dataset.minutes);
    expect(u).toBe(6);
    expect(c).toBe(3);
    expect(u + c).toBe(Number(bar.dataset.over));
    expect(screen.getAllByTestId('finding-card').length).toBeGreaterThanOrEqual(2);
    expect(within(screen.getByLabelText('What Saathi noticed')).getByText(/idled for 30 minutes/)).toBeTruthy();
    await waitFor(() => expect(speaker.said[0]?.message_key).toBe('debrief_over'));
  });
});

describe('Training Hub', () => {
  it('shows recommended lessons, a 6-lesson library and a disabled instructor booking', async () => {
    store.set({ findings: [{ type: 'excessive_idling', severity: 'medium', window_timestamp: 'x', message_key: 'finding.excessive_idling', slots: { minutes: 30 } }] });
    renderAt('/hub');
    const rec = await screen.findByTestId('hub-recommended');
    expect(within(rec).getByTestId('lesson-lesson_idle_engine_off')).toBeTruthy();
    expect(within(screen.getByTestId('hub-library')).getAllByRole('button')).toHaveLength(6);
    expect(screen.getByText('Book an instructor').closest('button').disabled).toBe(true);
  });

  it('plays a lesson on tap and lists it under Completed', async () => {
    renderAt('/hub');
    fireEvent.click(within(await screen.findByTestId('hub-library')).getByTestId('lesson-lesson_three_points'));
    await waitFor(() => expect(screen.getByTestId('hub-completed').textContent).toMatch(/Three points of contact/));
    expect(speaker.said.at(-1).message_key).toBe('lesson_three_points');
  });
});

describe('Incidents', () => {
  it('logs a tapped incident and lists it for the machine', async () => {
    renderAt('/incidents');
    expect(await screen.findByTestId('incident-empty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('incident-person_in_zone'));
    const list = await screen.findByTestId('incident-list');
    expect(within(list).getByText('Person in zone')).toBeTruthy();
    expect(speaker.said.at(-1).message_key).toBe('incident_logged');
    expect(store.get().memory[0].message_key).toBe('memory_incident');
  });
});

describe('About and Break', () => {
  it('About states the synthetic-data and privacy notes', async () => {
    renderAt('/about');
    expect(await screen.findByText(/synthetic data calibrated to the provided tables/)).toBeTruthy();
    expect(screen.getByText(/never leaves this device/)).toBeTruthy();
  });

  it('Break shows the resting avatar and a countdown', async () => {
    renderAt('/break');
    expect((await screen.findByTestId('avatar')).dataset.state).toBe('rest');
    expect(screen.getByTestId('break-timer').textContent).toBe('10:00');
  });
});

describe('Audio unlock', () => {
  it('shows the Start Saathi overlay until tapped', async () => {
    resetApp({ unlocked: false });
    renderAt('/morning');
    fireEvent.click(await screen.findByTestId('start-saathi'));
    expect(screen.queryByTestId('start-saathi')).toBeNull();
  });
});

describe('UI fixes: unlock, mute, status chip, demo badge, labels', () => {
  it('the Start overlay unlocks once for the session and lines wait for it', async () => {
    const speaker = resetApp({ unlocked: false });
    sessionStorage.clear();
    render(<MemoryRouter initialEntries={['/morning']}><StartOverlay /><Morning /></MemoryRouter>);
    await screen.findByTestId('task-card-T101');
    await new Promise((r) => setTimeout(r, 200));
    expect(speaker.said).toEqual([]);                                    // nothing behind the overlay
    fireEvent.click(screen.getByTestId('start-saathi'));
    expect(screen.queryByTestId('start-saathi')).toBe(null);
    await waitFor(() => expect(speaker.said.some((e) => e.message_key === 'greeting')).toBe(true));
    // safety lines (Machine Memory notes) + the greeting; nothing else
    expect(speaker.said.filter((e) => e.priority !== 'safety').map((e) => e.message_key)).toEqual(['greeting']);
    expect(sessionStorage.getItem(UNLOCK_KEY)).toBe('1');
    expect(initialState().unlocked).toBe(true);                          // a reload / remount stays unlocked
  });

  it('coaching mute stops the current line and silences everything but safety', () => {
    resetApp();
    // a speaker whose lines keep playing until cancelled (so muting happens mid-line)
    const speaker = { said: [], cancelled: 0, available: true, fallbackToEnglish: false,
      speak(e) { this.said.push(e); return { text: e.message_key, lang: 'en', source: 'audio' }; },
      cancel() { this.cancelled += 1; } };
    configureVoice({ speaker });
    say({ priority: 'info', mode: 'friendly', message_key: 'rain_today' });
    say({ priority: 'coaching', mode: 'friendly', message_key: 'lesson_walkaround' });
    expect(store.get().speaking?.event.message_key).toBe('rain_today');
    setQuiet(true);
    expect(store.get().speaking).toBe(null);                             // stopped mid-line
    expect(speaker.cancelled).toBeGreaterThan(0);
    say({ priority: 'care', mode: 'care', message_key: 'break_time' });
    expect(speaker.said.map((e) => e.message_key)).toEqual(['rain_today']);
    expect(store.get().caption.key).toBe('break_time');                  // shown, not spoken
    say({ priority: 'safety', mode: 'alert', message_key: 'belt_before_move' });
    expect(speaker.said.at(-1).message_key).toBe('belt_before_move');   // safety still speaks
    setQuiet(false);
  });

  it('mute button shows a clear muted state and says what it does', () => {
    resetApp();
    renderAt('/morning');
    const btn = screen.getByTestId('quiet-toggle');
    expect(btn.getAttribute('aria-label')).toBe('Coaching mute');
    expect(btn.title).toMatch(/except safety/);
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.textContent).toMatch(/Coaching muted/);
    expect(screen.getByTestId('saathi-chip').textContent).toMatch(/Coaching muted/);
    fireEvent.click(btn);
  });

  it('chip says "ready" when idle and "Listening…" only while recognition runs', () => {
    resetApp();
    renderAt('/morning');
    const chip = () => screen.getByTestId('saathi-chip').textContent;
    expect(chip()).toMatch(/Saathi\s*ready/);
    expect(chip()).not.toMatch(/Listening/);
    act(() => store.set({ recognizing: true }));
    expect(chip()).toMatch(/Listening…/);
    act(() => store.set({ recognizing: false }));
    expect(chip()).toMatch(/ready/);
  });

  it('demo mode shows "Step N of 7" and the next step during the pause', () => {
    resetApp();
    renderAt('/morning');
    expect(screen.queryByTestId('demo-step')).toBe(null);
    act(() => patchDemo({ running: true, step: 2, between: false }));
    expect(screen.getByTestId('demo-step').textContent).toBe('Step 2 of 7 · Pre-task');
    act(() => patchDemo({ between: true }));
    expect(screen.getByTestId('demo-step').textContent).toBe('Step 2 of 7 · Next: In-task');
    act(() => patchDemo({ running: false }));
  });

  it('Pre-task says "Begin work" (Morning keeps "Start task") and the back arrow is labelled', async () => {
    resetApp();
    renderAt('/pretask/T101');
    const begin = await screen.findByRole('button', { name: /Begin work/ });
    expect(begin).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Start task/ })).toBe(null);
    const back = screen.getByTestId('pretask-back');
    expect(back.title).toBe("Back to today's tasks");
    act(() => store.set({ lang: 'hi' }));
    expect(screen.getByRole('button', { name: /काम चालू करें/ })).toBeTruthy();
  });
});
