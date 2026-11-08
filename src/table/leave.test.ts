import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine';
import { addPlayer, removePlayer } from './seating';
import { ctxFor, playUntilRecords, tableWith } from './testing';
import { applyCommand } from './table';
import type { Ctx, TableState } from './types';

const ctxOf = (seed: number) => (): Ctx => ctxFor(seed);

/** Starts a game with `count` humans (host p0, players p1..). */
function started(count: number, seed = 7): TableState {
  const s = tableWith(count);
  const result = applyCommand(s, 'p0', { type: 'start' }, ctxFor(seed));
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
}

/** Plays the running game to its end (no readiness yet). */
function finishGame(s: TableState, seed: number): TableState {
  const finished = playUntilRecords(s, s.records.length + 1, ctxOf(seed), mulberry32(seed));
  if (finished.game?.engine.phase !== 'finished') throw new Error('game did not finish');
  return finished;
}

/** Every seated human presses "continue"; returns the state before the last press. */
function readyAll(s: TableState, seed: number): { before: TableState; after: TableState } {
  const humans = s.players.filter((p) => !p.isBot && p.connected).map((p) => p.id);
  let current = s;
  for (const id of humans.slice(0, -1)) {
    const result = applyCommand(current, id, { type: 'ready' }, ctxFor(seed));
    if (!result.ok) throw new Error(result.error.message);
    current = result.value.state;
  }
  const last = humans[humans.length - 1];
  if (last === undefined) throw new Error('no humans to ready');
  const result = applyCommand(current, last, { type: 'ready' }, ctxFor(seed));
  if (!result.ok) throw new Error(result.error.message);
  return { before: current, after: result.value.state };
}

const seatIds = (s: TableState): string[] => s.players.map((p) => p.id);

describe('leave in the lobby', () => {
  it('removes the leaving player from the seats', () => {
    const s = tableWith(4);
    const result = applyCommand(s, 'p1', { type: 'leave' }, ctxFor(1));
    if (!result.ok) throw new Error(result.error.message);
    expect(seatIds(result.value.state)).toEqual(['p0', 'p2', 'p3']);
  });

  it('removes a pending player during a running game', () => {
    let s = started(4);
    const added = addPlayer(s, { id: 'p9', name: 'Pending' });
    if (!added.ok) throw new Error(added.error.message);
    s = added.value;
    expect(s.pending.map((p) => p.id)).toEqual(['p9']);
    const result = applyCommand(s, 'p9', { type: 'leave' }, ctxFor(1));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.state.pending).toEqual([]);
  });
});

describe('leave during a running game', () => {
  it('keeps the seat, marks the player as leaving and disconnected', () => {
    const s = started(4);
    const game = s.game;
    const result = applyCommand(s, 'p1', { type: 'leave' }, ctxFor(1));
    if (!result.ok) throw new Error(result.error.message);
    const p1 = result.value.state.players.find((p) => p.id === 'p1');
    expect(p1?.connected).toBe(false);
    expect(p1?.leaving).toBe(true);
    expect(result.value.state.players).toHaveLength(4);
    expect(result.value.state.game).toBe(game);
  });

  it('removes the leaver when the next game is dealt', () => {
    const seed = 11;
    const s = leaveMidGame(started(4, seed), 'p1', seed);
    const finished = finishGame(s, seed);
    const { before, after } = readyAll(finished, seed);
    expect(after.game?.engine.phase).not.toBe('finished');
    expect(seatIds(after)).toEqual(['p0', 'p2', 'p3']);
    expect(after.players.some((p) => p.leaving === true)).toBe(false);
    // The dealer pointer keeps pointing at the same upcoming dealer (see removePlayer).
    const expected = removePlayer(before, 'p1');
    expect(after.game?.dealerId).toBe(expected.players[expected.nextDealerIdx]?.id);
  });

  it('returns to the lobby when fewer than three players remain', () => {
    const seed = 13;
    const s = leaveMidGame(started(3, seed), 'p1', seed);
    const finished = finishGame(s, seed);
    const { after } = readyAll(finished, seed);
    expect(after.status).toBe('lobby');
    expect(after.game).toBeNull();
    expect(seatIds(after)).toEqual(['p0', 'p2']);
  });

  it('a player who reconnects before the next deal is no longer leaving', () => {
    const seed = 17;
    const left = leaveMidGame(started(4, seed), 'p1', seed);
    const back = addPlayer(left, { id: 'p1', name: 'Player 1' });
    if (!back.ok) throw new Error(back.error.message);
    const p1 = back.value.players.find((p) => p.id === 'p1');
    expect(p1?.connected).toBe(true);
    expect(p1?.leaving).not.toBe(true);
    const { after } = readyAll(finishGame(back.value, seed), seed);
    expect(seatIds(after)).toContain('p1');
  });

  it('the host aborting the game removes the leaver from the next game', () => {
    const seed = 19;
    const left = leaveMidGame(started(4, seed), 'p1', seed);
    const result = applyCommand(left, 'p0', { type: 'abort-game' }, ctxFor(seed));
    if (!result.ok) throw new Error(result.error.message);
    const next = result.value.state;
    expect(seatIds(next)).toEqual(['p0', 'p2', 'p3']);
    expect(Object.values(next.game?.roles ?? {})).not.toContain('p1');
  });
});

describe('leave errors', () => {
  it('the host cannot leave', () => {
    const s = tableWith(3);
    const result = applyCommand(s, 'p0', { type: 'leave' }, ctxFor(1));
    expect(result.ok ? null : result.error.code).toBe('HOST_CANNOT_LEAVE');
  });

  it('an unknown player gets UNKNOWN_PLAYER and the state is unchanged', () => {
    const s = tableWith(3);
    const snapshot: unknown = JSON.parse(JSON.stringify(s));
    const result = applyCommand(s, 'nobody', { type: 'leave' }, ctxFor(1));
    expect(result.ok ? null : result.error.code).toBe('UNKNOWN_PLAYER');
    expect(s).toEqual(snapshot);
  });
});

/** Leaves during a running game: the player disconnects but keeps the seat until the next deal. */
function leaveMidGame(s: TableState, id: string, seed: number): TableState {
  const result = applyCommand(s, id, { type: 'leave' }, ctxFor(seed));
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
}
