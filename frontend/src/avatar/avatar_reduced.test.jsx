// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => true }));

const { default: Avatar, AVATAR_STATES } = await import('./Avatar.jsx');

describe('Avatar with reduced motion', () => {
  it('skips the wave', () => {
    render(<Avatar state="idle" wave />);
    expect(screen.queryByTestId('avatar-arm')).toBeNull();
    expect(screen.queryByTestId('avatar-hi')).toBeNull();
  });

  it.each(AVATAR_STATES)('renders the %s state', (state) => {
    render(<Avatar state={state} wave />);
    expect(screen.getByTestId('avatar').dataset.state).toBe(state);
  });
});
