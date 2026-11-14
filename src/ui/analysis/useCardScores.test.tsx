// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CardId } from '../../engine';
import { analysisStart, positionAt } from '../../table';
import { fakeWorker, playedInput } from './analysisFixtures';
import { ROLLOUT_EPSILON } from '../../table';
import { useCardScores } from './useCardScores';

afterEach(() => { cleanup(); });

const input = playedInput();
const firstCard: CardId | undefined = input.plays[0];

describe('useCardScores', () => {
  it('starts one analysis at mount and shows the first batch', () => {
    const worker = fakeWorker();
    const { result } = renderHook(() => useCardScores(input, [], false, false, ROLLOUT_EPSILON, worker.factory));
    expect(worker.sent).toEqual([
      expect.objectContaining({ type: 'analyze', id: 1, plays: [], initial: null, useRealHands: false, epsilon: ROLLOUT_EPSILON }),
    ]);
    worker.drain(1);
    expect(result.current.error).toBeNull();
    expect(result.current.stats.length).toBeGreaterThan(0);
    expect(result.current.stats.every((s) => s.samples === 8)).toBe(true);
  });

  it('restarts with a higher id and empty stats when the line changes; old answers are ignored', () => {
    if (firstCard === undefined) throw new Error('expected a first card');
    const worker = fakeWorker();
    const { result, rerender } = renderHook(
      ({ plays }: { plays: readonly CardId[] }) => useCardScores(input, plays, false, false, ROLLOUT_EPSILON, worker.factory),
      { initialProps: { plays: [] as readonly CardId[] } },
    );
    worker.drain(1);
    expect(result.current.stats.length).toBeGreaterThan(0);

    rerender({ plays: [firstCard] });
    expect(worker.sent.at(-1)).toMatchObject({ type: 'analyze', id: 2, initial: null, plays: [firstCard] });
    expect(result.current.stats).toEqual([]);

    worker.drain(1); // the step of request 1 still waits in the queue; it must post nothing
    expect(result.current.stats).toEqual([]);

    worker.drain(1);
    expect(result.current.stats.every((s) => s.samples === 8)).toBe(true);
  });

  it('stops on pause and resumes from the shown stats', () => {
    const worker = fakeWorker();
    const { result, rerender } = renderHook(
      ({ paused }: { paused: boolean }) => useCardScores(input, [], false, paused, ROLLOUT_EPSILON, worker.factory),
      { initialProps: { paused: false } },
    );
    worker.drain(1);
    const shown = result.current.stats;

    rerender({ paused: true });
    expect(worker.sent.at(-1)).toEqual({ type: 'stop' });
    expect(result.current.stats).toEqual(shown);

    rerender({ paused: false });
    expect(worker.sent.at(-1)).toMatchObject({ type: 'analyze', initial: shown });
    worker.drain(2); // the stale step of the paused request runs first and posts nothing

    expect(result.current.stats.every((s) => s.samples === 16)).toBe(true);
  });

  it('shows the error code of a rejected position', () => {
    const start = analysisStart(input);
    if (!start.ok || start.value === null) throw new Error('expected a start state');
    const position = positionAt(start.value, []);
    if (!position.ok) throw new Error('expected a position');
    const roles = ['forehand', 'middlehand', 'hindhand'] as const;
    const illegal = roles.flatMap((role) => input.hands[role]).find((c) => !position.value.playable.includes(c));
    if (illegal === undefined) throw new Error('expected an illegal card');
    const worker = fakeWorker();
    const { result } = renderHook(() => useCardScores(input, [illegal], false, false, ROLLOUT_EPSILON, worker.factory));
    worker.drain(1);
    expect(result.current.error).toBe('ILLEGAL_CARD');
    expect(result.current.stats).toEqual([]);
  });

  it('terminates the worker on unmount', () => {
    const worker = fakeWorker();
    const { unmount } = renderHook(() => useCardScores(input, [], false, false, ROLLOUT_EPSILON, worker.factory));
    expect(worker.terminated()).toBe(0);
    unmount();
    expect(worker.terminated()).toBe(1);
  });

  it('starts over with empty stats when the epsilon changes', () => {
    const worker = fakeWorker();
    const { result, rerender } = renderHook(
      ({ epsilon }: { epsilon: number }) => useCardScores(input, [], false, false, epsilon, worker.factory),
      { initialProps: { epsilon: 0.1 } },
    );
    worker.drain(1);
    expect(result.current.stats.length).toBeGreaterThan(0);
    rerender({ epsilon: 0.3 });
    expect(worker.sent.at(-1)).toMatchObject({ type: 'analyze', id: 2, epsilon: 0.3, initial: null });
    expect(result.current.stats).toEqual([]);
  });
});
