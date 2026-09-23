// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, act, waitFor, fireEvent } from '@testing-library/react';
import { resetApp, renderAt } from '../test/helpers.jsx';
import { say } from '../saathi/voiceRuntime.js';
import { store } from '../state/store.js';
import { fixture } from '../fixtures.js';
import { startReplay } from '../saathi/replayRuntime.js';

beforeEach(() => resetApp());

describe('Stage View', () => {
  it('shows the operator app, the Under the hood panel and the simulated-data badge', async () => {
    renderAt('/stage/morning');
    expect(await screen.findByTestId('operator-app')).toBeTruthy();
    expect(screen.getByTestId('under-the-hood')).toBeTruthy();
    expect(screen.getByTestId('sim-badge').textContent).toMatch(/Simulated data/);
  });

  it('logs a voice-queue decision when an event is emitted', async () => {
    renderAt('/stage/about');
    await screen.findByTestId('screen-about');
    act(() => { say({ priority: 'info', mode: 'friendly', message_key: 'rain_today' }); });
    const row = await screen.findByTestId('vq-row');
    expect(row.textContent).toMatch(/spoken/);
    expect(row.textContent).toMatch(/rain_today/);
    expect(row.textContent).toMatch(/phrasing \d\/3/);
  });

  it('logs held coaching lines (budget) and safety preemption', async () => {
    renderAt('/stage/about');
    await screen.findByTestId('screen-about');
    act(() => {
      say({ priority: 'coaching', mode: 'friendly', message_key: 'lesson_hydration' });
      say({ priority: 'coaching', mode: 'friendly', message_key: 'lesson_walkaround' });
    });
    await waitFor(() => expect(screen.getByTestId('uth-queue').textContent).toMatch(/held — coaching budget used/));
  });

  it('streams telemetry rows and lights up replay events', async () => {
    renderAt('/stage/about');
    await screen.findByTestId('screen-about');
    act(() => { startReplay(fixture('scenarioDemo'), { speed: Infinity }); });
    await waitFor(() => expect(store.get().replay.done).toBe(true));
    const tele = screen.getByTestId('uth-telemetry');
    expect(within(tele).getAllByText(/^\d\d:\d\d$/).length).toBeGreaterThan(3);
    expect(screen.getByTestId('uth-events').textContent).toMatch(/Safety alert/);
    expect(screen.getByTestId('uth-queue').textContent).toMatch(/belt_before_move/);
  });

  it('toggles to the full-screen operator view', async () => {
    renderAt('/stage/morning');
    fireEvent.click(await screen.findByTestId('toggle-operator'));
    await waitFor(() => expect(screen.queryByTestId('under-the-hood')).toBeNull());
    expect(screen.getByTestId('operator-app')).toBeTruthy();
  });
});
