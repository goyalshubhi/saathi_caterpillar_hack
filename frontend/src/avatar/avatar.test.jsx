// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Avatar, { AVATAR_STATES, WAVE_MS, wavePose } from './Avatar.jsx';

describe('Avatar', () => {
  it.each(AVATAR_STATES)('renders the %s state', (state) => {
    render(<Avatar state={state} />);
    const el = screen.getByTestId('avatar');
    expect(el.dataset.state).toBe(state);
    expect(el.querySelector('svg')).toBeTruthy();
  });

  it('holds a water bottle only when resting', () => {
    const { container, rerender } = render(<Avatar state="rest" />);
    const rects = () => container.querySelectorAll('rect').length;
    expect(rects()).toBeGreaterThan(0);
    rerender(<Avatar state="idle" />);
    expect(rects()).toBe(0);
  });

  it('gives each instance its own SVG ids', () => {
    const { container } = render(<><Avatar /><Avatar /></>);
    const ids = [...container.querySelectorAll('[id]')].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(AVATAR_STATES)('still renders the %s state with the wave requested', (state) => {
    render(<Avatar state={state} wave />);
    const el = screen.getByTestId('avatar');
    expect(el.dataset.state).toBe(state);
    expect(el.querySelector('svg')).toBeTruthy();
  });
});

describe('Avatar wave', () => {
  const fakeClock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] });
  afterEach(() => vi.useRealTimers());

  it('raises the arm, waves and lowers it around the shoulder', () => {
    expect(wavePose(0).angle).toBe(160);
    expect(wavePose(0.2).angle).toBe(20);
    expect(wavePose(1).angle).toBe(160);
    expect(wavePose(0).arm).toBe(0);
    expect(wavePose(1).arm).toBe(0);
    expect(wavePose(0.5).bubble).toBe(1);
  });

  it('waves once with a "Hi!" bubble, then returns cleanly to idle', () => {
    fakeClock();
    const done = vi.fn();
    render(<Avatar state="idle" wave onWaveDone={done} />);
    const el = screen.getByTestId('avatar');
    expect(el.dataset.waving).toBe('true');
    expect(screen.getByTestId('avatar-hi').textContent).toBe('Hi!');
    act(() => { vi.advanceTimersByTime(WAVE_MS / 4); });
    expect(screen.getByTestId('avatar-arm').getAttribute('transform')).toMatch(/^rotate\([\d.-]+ 150 172\)$/);
    act(() => { vi.advanceTimersByTime(WAVE_MS); });
    expect(done).toHaveBeenCalledTimes(1);
    expect(el.dataset.waving).toBeUndefined();
    expect(screen.queryByTestId('avatar-arm')).toBeNull();
    expect(screen.queryByTestId('avatar-hi')).toBeNull();
    expect(el.dataset.state).toBe('idle');
  });

  it('keeps waving while speaking but stops for an alert', () => {
    fakeClock();
    const done = vi.fn();
    const { rerender } = render(<Avatar state="idle" wave onWaveDone={done} />);
    rerender(<Avatar state="speaking" wave onWaveDone={done} />);
    expect(screen.getByTestId('avatar-arm')).toBeTruthy();
    rerender(<Avatar state="alert" wave onWaveDone={done} />);
    expect(screen.queryByTestId('avatar-arm')).toBeNull();
    expect(done).toHaveBeenCalled();
    expect(screen.getByTestId('avatar').dataset.state).toBe('alert');
  });

  it('does not wave without the wave prop', () => {
    render(<Avatar state="idle" />);
    expect(screen.queryByTestId('avatar-arm')).toBeNull();
    expect(screen.getByTestId('avatar').dataset.waving).toBeUndefined();
  });
});
