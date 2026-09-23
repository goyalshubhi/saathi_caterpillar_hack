// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Avatar, { AVATAR_STATES } from './Avatar.jsx';

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
});
