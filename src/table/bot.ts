// Random bots for tests, demos and "Add bot" (docs/04-game-engine.md B3). Not an AI.

import { enumerateActions, type GameAction, type GameState, type Role } from '../engine';
import { applyCommand } from './table';
import type { Ctx, TableState } from './types';

const PASS_PROBABILITY = 0.6;
const LOWEST_BIDS = 3;

function pickOne<T>(items: readonly T[], rand: () => number): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) {
    throw new Error('bot has no action to choose from');
  }
  return item;
}

/** A legal action for `role`: uniform, except that bidding usually passes and otherwise bids low. */
export function botAction(game: GameState, role: Role, rand: () => number): GameAction {
  const actions = enumerateActions(game, role);
  if (game.phase !== 'bidding') return pickOne(actions, rand);
  const pass = actions.find((a) => a.type === 'pass');
  if (pass !== undefined && rand() < PASS_PROBABILITY) return pass;
  const lowBids = actions.filter((a) => a.type === 'bid').slice(0, LOWEST_BIDS);
  const others = actions.filter((a) => a.type === 'hold' || a.type === 'claim');
  const pool = [...lowBids, ...others];
  return pickOne(pool.length > 0 ? pool : actions, rand);
}

/**
 * Lets the bot whose turn it is act once. Returns null when no bot can act now (a human must
 * act, or the table waits for a human to press "ready").
 */
export function botStep(s: TableState, ctx: () => Ctx, rand: () => number): TableState | null {
  const game = s.game;
  if (game === null || game.engine.phase === 'finished' || game.engine.turn === null) return null;
  const role = game.engine.turn;
  const playerId = game.roles[role];
  const isBot = s.players.some((p) => p.id === playerId && p.isBot);
  if (!isBot) return null;
  const action = botAction(game.engine, role, rand);
  const result = applyCommand(s, playerId, { type: 'game', action }, ctx());
  if (!result.ok) {
    throw new Error(`bot action rejected: ${result.error.code} ${result.error.message}`);
  }
  return result.value.state;
}

/** Runs bot turns until a human must act or `maxSteps` actions have been taken. */
export function runBots(
  s: TableState,
  ctx: () => Ctx,
  rand: () => number,
  maxSteps = 100_000,
): TableState {
  let state = s;
  for (let i = 0; i < maxSteps; i++) {
    const next = botStep(state, ctx, rand);
    if (next === null) return state;
    state = next;
  }
  return state;
}
