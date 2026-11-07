// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView, ViewLastTrick } from '../../table';
import { useShownTrick } from './useShownTrick';

function game(overrides: Partial<GameView>): GameView {
  return { trick: { leaderId: 'a', plays: [] }, lastTrick: null, ...overrides } as GameView;
}
const LAST: ViewLastTrick = {
  leaderId: 'a', winnerId: 'b',
  plays: [{ playerId: 'a', card: 'CA' }, { playerId: 'b', card: 'C10' }, { playerId: 'c', card: 'C7' }],
};
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useShownTrick', () => {
  it('holds a new completed trick for the configured duration, even as the next trick starts', () => {
    const { result, rerender } = renderHook(({ g, ms }) => useShownTrick(g, ms), {
      initialProps: { g: game({}), ms: 600 },
    });
    expect(result.current.plays).toEqual([]);
    act(() => { rerender({ g: game({ lastTrick: LAST }), ms: 600 }); });
    expect(result.current.plays.map((p) => p.winner)).toEqual([false, true, false]);
    expect(result.current.holding).toBe(true);
    act(() => { rerender({ g: game({ lastTrick: LAST, trick: { leaderId: 'b', plays: [{ playerId: 'b', card: 'HA' }] } }), ms: 600 }); });
    expect(result.current.plays[0]?.card).toBe('CA');
    act(() => { vi.advanceTimersByTime(599); });
    expect(result.current.holding).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.plays).toEqual([{ playerId: 'b', card: 'HA', winner: false }]);
  });

  it('does not hold the initial trick and supports dismiss and zero duration', () => {
    const { result, rerender } = renderHook(({ g, ms }) => useShownTrick(g, ms), {
      initialProps: { g: game({ lastTrick: LAST }), ms: 600 },
    });
    expect(result.current.holding).toBe(false);
    act(() => { rerender({ g: game({}), ms: 600 }); });
    act(() => { rerender({ g: game({ lastTrick: LAST }), ms: 600 }); });
    act(() => { result.current.dismiss(); });
    expect(result.current.holding).toBe(false);
    act(() => { rerender({ g: game({}), ms: 0 }); });
    act(() => { rerender({ g: game({ lastTrick: LAST }), ms: 0 }); });
    expect(result.current.holding).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
