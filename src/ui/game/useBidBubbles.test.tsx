// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewBidEvent } from '../../table';
import { useBidBubbles } from './useBidBubbles';

const bid = (playerId: string, value: number): ViewBidEvent => ({ playerId, type: 'bid', value });
const hold = (playerId: string): ViewBidEvent => ({ playerId, type: 'hold' });
const first = [bid('a', 18)];

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useBidBubbles', () => {
  it('shows no bubble for events that are already in the history at mount', () => {
    const { result } = renderHook(({ h }) => useBidBubbles(h, 1000), { initialProps: { h: first } });
    expect(result.current).toEqual({});
  });

  it('shows a bubble for a new event and removes it after the duration', () => {
    const { result, rerender } = renderHook(({ h }) => useBidBubbles(h, 1000), { initialProps: { h: first } });
    act(() => { rerender({ h: [...first, hold('b')] }); });
    expect(result.current.b?.event).toEqual(hold('b'));
    act(() => { vi.advanceTimersByTime(999); });
    expect(result.current.b).toBeDefined();
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.b).toBeUndefined();
  });

  it('does not extend the bubble of one player when another player bids later', () => {
    const { result, rerender } = renderHook(({ h }) => useBidBubbles(h, 1000), { initialProps: { h: first } });
    act(() => { rerender({ h: [...first, bid('b', 20)] }); });
    act(() => { vi.advanceTimersByTime(500); });
    act(() => { rerender({ h: [...first, bid('b', 20), hold('c')] }); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.b).toBeUndefined();
    expect(result.current.c?.event).toEqual(hold('c'));
  });

  it('restarts the time of a player who bids again', () => {
    const { result, rerender } = renderHook(({ h }) => useBidBubbles(h, 1000), { initialProps: { h: first } });
    act(() => { rerender({ h: [...first, bid('b', 20)] }); });
    act(() => { vi.advanceTimersByTime(800); });
    act(() => { rerender({ h: [...first, bid('b', 20), bid('b', 22)] }); });
    act(() => { vi.advanceTimersByTime(800); });
    expect(result.current.b?.event).toEqual(bid('b', 22));
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.b).toBeUndefined();
  });

  it('shows nothing when the duration is 0', () => {
    const { result, rerender } = renderHook(({ h }) => useBidBubbles(h, 0), { initialProps: { h: first } });
    act(() => { rerender({ h: [...first, bid('b', 20)] }); });
    expect(result.current).toEqual({});
  });

  it('shows one bubble per player, the latest one, for several events appended at once', () => {
    const { result, rerender } = renderHook(({ h }) => useBidBubbles(h, 1000), { initialProps: { h: first } });
    act(() => { rerender({ h: [...first, bid('b', 20), hold('a'), bid('b', 22)] }); });
    expect(result.current.a?.event).toEqual(hold('a'));
    expect(result.current.b?.event).toEqual(bid('b', 22));
  });
});
