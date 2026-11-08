// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettings } from '../store/settings';
import { OpponentSeat } from './OpponentSeat';

afterEach(() => {
  cleanup();
});

describe('OpponentSeat connection dot', () => {
  it('shows a green dot for a connected player and a red one for an offline player', () => {
    useSettings.getState().update({ language: 'en' });
    const { unmount } = render(<OpponentSeat name="Anna" count={10} connected />);
    expect(screen.getByLabelText('connected').getAttribute('data-state')).toBe('online');
    unmount();
    render(<OpponentSeat name="Ben" count={10} connected={false} />);
    expect(screen.getByLabelText('offline').getAttribute('data-state')).toBe('offline');
  });
});
