// Bot orchestration on a table (docs/bots.md). The strategies live in ./bot/ and
// only receive the seat-limited BotView (docs/bots.md).

import { botAction } from './bot/index';
import { applyCommand } from './table';
import type { Ctx, TableState } from './types';

/** Lets the bot whose turn it is act once; null means a human must act or the table waits. */
export function botStep(s: TableState, ctx: () => Ctx, rand: () => number): TableState | null {
  const game = s.game;
  if (game === null || game.engine.phase === 'finished' || game.engine.turn === null) return null;
  const role = game.engine.turn;
  const playerId = game.roles[role];
  const bot = s.players.find((p) => p.id === playerId && p.isBot);
  if (bot === undefined) return null;
  const action = botAction(game.engine, role, bot.botLevel ?? 'normal', rand);
  const result = applyCommand(s, playerId, { type: 'game', action }, ctx());
  if (!result.ok) throw new Error(`bot action rejected: ${result.error.code} ${result.error.message}`);
  return result.value.state;
}

/** Runs bot turns until a human must act or `maxSteps` actions have been taken. */
export function runBots(s: TableState, ctx: () => Ctx, rand: () => number, maxSteps = 100_000): TableState {
  let state = s;
  for (let i = 0; i < maxSteps; i++) {
    const next = botStep(state, ctx, rand);
    if (next === null) return state;
    state = next;
  }
  return state;
}

export { botAction, botViewOf } from './bot/index';
