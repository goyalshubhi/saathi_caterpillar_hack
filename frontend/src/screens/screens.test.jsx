// @vitest-environment jsdom
// Every operator screen renders with fixture data (API in FIXTURE mode) and speaks what it should.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { resetApp, renderAt } from '../test/helpers.jsx';
import { store } from '../state/store.js';
import { say } from '../saathi/voiceRuntime.js';

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

  it('speaks the morning briefing once, in order', async () => {
    renderAt('/morning');
    await waitFor(() => expect(speaker.said.some((e) => e.message_key === 'breaks_planned')).toBe(true));
    expect(speaker.said.map((e) => e.message_key)).toEqual([
      'shift_hello', 'greeting', 'task_card', 'task_card', 'task_card', 'rain_today', 'heat_today', 'plan_order', 'breaks_planned',
    ]);
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
    expect(screen.getByTestId('saathi-chip').textContent).toMatch(/Listening/);
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
