// Test helpers for driving tables. Not exported from index.ts.

import { enumerateActions, type GameAction } from '../engine';
import { applyCommand, createTable } from './table';
import { addPlayer } from './seating';
import type { Ctx, TableState } from './types';

export function pickRandom<T>(items: readonly T[], rand: () => number): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) {
    throw new Error('nothing to pick from');
  }
  return item;
}

/** A table with host `p0` and players `p1`, `p2`, ... (humans unless `bots` is set). */
export function tableWith(count: number, options: { bots?: boolean; maxSeats?: number } = {}): TableState {
  let s = createTable({
    key: 'TESTKEY',
    name: 'Test table',
    isPublic: false,
    hostId: 'p0',
    hostName: 'Host',
    maxSeats: options.maxSeats ?? 6,
  });
  for (let i = 1; i < count; i++) {
    const added = addPlayer(s, { id: `p${String(i)}`, name: `Player ${String(i)}`, isBot: options.bots ?? false });
    if (!added.ok) throw new Error(added.error.message);
    s = added.value;
  }
  return s;
}

export function ctxFor(seed: number, now = 0): Ctx {
  return { now, seed };
}


/** One step of random play: a random legal game action for the player on turn, or readying a human. */
export function randomStep(s: TableState, ctx: Ctx, rand: () => number): TableState | null {
  const game = s.game;
  if (game === null) return null;
  if (game.engine.phase === 'finished') {
    const waiting = s.players.find((p) => !p.isBot && p.connected && !s.ready.includes(p.id));
    if (waiting === undefined) return null;
    const result = applyCommand(s, waiting.id, { type: 'ready' }, ctx);
    if (!result.ok) throw new Error(result.error.message);
    return result.value.state;
  }
  const turn = game.engine.turn;
  if (turn === null) return null;
  const actions: GameAction[] = enumerateActions(game.engine, turn);
  const action = pickRandom(actions, rand);
  const result = applyCommand(s, game.roles[turn], { type: 'game', action }, ctx);
  if (!result.ok) throw new Error(`random legal action rejected: ${result.error.code}`);
  return result.value.state;
}

/** Plays random legal moves (humans too) until `records` games are finished. */
export function playUntilRecords(
  start: TableState,
  records: number,
  ctxOf: () => Ctx,
  rand: () => number,
  maxSteps = 100_000,
): TableState {
  let s = start;
  for (let i = 0; i < maxSteps && s.records.length < records; i++) {
    const next = randomStep(s, ctxOf(), rand);
    if (next === null) break;
    s = next;
  }
  return s;
}
