// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView, ViewLastTrick } from '../../table';
import { LAST_TRICK_MS, useShownTrick } from './useShownTrick';

function game(overrides: Partial<GameView>): GameView {
  return {
    trick: { leaderId: 'a', plays: [] },
    lastTrick: null,
    ...overrides,
  } as GameView;
}

const LAST: ViewLastTrick = {
  leaderId: 'a',
  winnerId: 'b',
  plays: [
    { playerId: 'a', card: 'CA' },
    { playerId: 'b', card: 'C10' },
    { playerId: 'c', card: 'C7' },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useShownTrick', () => {
  it('shows a completed trick for a moment, with the winner marked', () => {
    const { result, rerender } = renderHook(({ g }) => useShownTrick(g), {
      initialProps: { g: game({}) },
    });
    expect(result.current).toEqual([]);

    rerender({ g: game({ lastTrick: LAST }) });
    expect(result.current.map((p) => p.winner)).toEqual([false, true, false]);

    act(() => {
      vi.advanceTimersByTime(LAST_TRICK_MS);
    });
    expect(result.current).toEqual([]);
  });

  it('replaces the display as soon as the next trick is played', () => {
    const { result, rerender } = renderHook(({ g }) => useShownTrick(g), {
      initialProps: { g: game({}) },
    });
    rerender({ g: game({ lastTrick: LAST }) });
    expect(result.current).toHaveLength(3);
    rerender({ g: game({ lastTrick: LAST, trick: { leaderId: 'b', plays: [{ playerId: 'b', card: 'HA' }] } }) });
    expect(result.current).toEqual([{ playerId: 'b', card: 'HA', winner: false }]);
  });
});
