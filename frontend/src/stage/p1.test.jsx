// @vitest-environment jsdom
// P1: What-if panel, Architecture diagram, voice incident logging, Break screen.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resetApp, renderAt } from '../test/helpers.jsx';
import { store, markArch } from '../state/store.js';
import { ArchitectureDiagram } from './ArchitecturePage.jsx';
import { interpret } from '../components/VoiceLog.jsx';

let speaker;
beforeEach(() => { speaker = resetApp(); });

describe('What-if', () => {
  it('opens, and explains that it needs POST /predict when the API does not offer it', async () => {
    renderAt('/stage/pretask/T101');
    await screen.findByTestId('screen-pretask');
    fireEvent.click(within(screen.getByTestId('what-if')).getByRole('button', { expanded: false }));
    expect(await screen.findByTestId('what-if-unavailable')).toBeTruthy();
    expect(screen.getByTestId('what-if').textContent).toMatch(/Trenching \(T101\)/);
  });

  it('Pre-task shows a what-if prediction when one is set for the task', async () => {
    renderAt('/pretask/T101');
    await screen.findByTestId('saathi-prediction');
    act(() => {
      store.set({ whatIf: { task_id: 'T101', cat_estimate_min: 45, predicted_min: 61, uncontrollable_min: 16, controllable_min: 0, top_factors: [{ name: 'weather', minutes: 9 }], task: { ...store.get().tasks[0], weather: 'Windy' } } });
    });
    await waitFor(() => expect(screen.getByTestId('saathi-prediction').querySelector('[data-value="61"]')).toBeTruthy());
    expect(screen.getByText(/Windy/)).toBeTruthy();
  });
});

describe('Architecture', () => {
  it('draws the six stages on the device and lights up the active one', () => {
    const { container } = render(<MemoryRouter><ArchitectureDiagram /></MemoryRouter>);
    for (const label of ['Machine telemetry', 'Replay / ingest', 'Rules + ML models', 'Planner', 'Voice queue', 'Saathi']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(/except confirmed incident records/)).toBeTruthy();
    act(() => markArch('models'));
    expect(container.querySelector('[data-active] text').textContent).toBe('Rules + ML models');
  });
});

describe('Voice incident logging', () => {
  it('interprets descriptions as incidents and fixed phrases as commands', async () => {
    expect(await interpret('a worker walked behind the machine')).toMatchObject({ kind: 'incident', category: 'person_in_zone' });
    expect(await interpret('quiet mode')).toEqual({ kind: 'command', command: 'quiet_mode' });
    expect(await interpret('log incident')).toEqual({ kind: 'ask' });
  });

  it('typed report -> confirm step -> logged with source voice', async () => {
    renderAt('/incidents');
    await screen.findByTestId('incident-empty');
    fireEvent.click(screen.getByLabelText('Type what happened'));
    fireEvent.change(screen.getByTestId('voice-log-input'), { target: { value: 'oil leak near the engine' } });
    fireEvent.click(screen.getByTestId('voice-log-submit'));
    const dialog = await screen.findByTestId('voice-confirm');
    expect(within(dialog).getByRole('button', { pressed: true }).textContent).toMatch(/Machine issue/);
    fireEvent.click(screen.getByTestId('voice-confirm-log'));
    const list = await screen.findByTestId('incident-list');
    expect(within(list).getByText('Machine issue')).toBeTruthy();
    expect(within(list).getByText('Voice')).toBeTruthy();
    expect(store.get().incidents[0]).toMatchObject({ category: 'machine_issue', source: 'voice', note: 'oil leak near the engine' });
    expect(store.get().incidents[0].operator_id).toBeUndefined();
  });

  it('the quiet-mode command turns quiet mode on', async () => {
    renderAt('/incidents');
    await screen.findByTestId('incident-empty');
    fireEvent.click(screen.getByLabelText('Type what happened'));
    fireEvent.change(screen.getByTestId('voice-log-input'), { target: { value: 'quiet mode' } });
    fireEvent.click(screen.getByTestId('voice-log-submit'));
    await waitFor(() => expect(store.get().quiet).toBe(true));
    expect(speaker.said.at(-1).message_key).toBe('cmd_quiet_on');
  });
});

describe('Break (care)', () => {
  it('shows the care reason and speaks the care break line', async () => {
    renderAt('/break?reason=care');
    expect(await screen.findByText(/you have earned it/)).toBeTruthy();
    await waitFor(() => expect(speaker.said.at(-1)?.message_key).toBe('care_break'));
  });
});
