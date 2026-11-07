// Bot orchestration. Strategy code receives only the seat-limited BotView.

import { nextBidValue, rankOf, type GameAction, type GameState, type Role } from '../engine';
import { botViewOf, type BotView } from './bot/knowledge';
import { applyCommand } from './table';
import type { BotLevel, Ctx, TableState } from './types';

const PASS_PROBABILITY = 0.6;

function pickOne<T>(items: readonly T[], rand: () => number): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error('bot has no legal action to choose from');
  return item;
}

function handStrength(view: BotView): number {
  const jacks = view.hand.filter((card) => rankOf(card) === 'J').length;
  const aces = view.hand.filter((card) => rankOf(card) === 'A').length;
  const tens = view.hand.filter((card) => rankOf(card) === '10').length;
  return jacks * 3 + aces * 1.5 + tens * 0.5;
}

function strategicAction(view: BotView): GameAction | null {
  const actions = view.actions;
  if (view.phase === 'bidding') {
    const strength = handStrength(view);
    const next = nextBidValue(view.currentBid);
    if (view.awaiting === 'caller') {
      if (next !== null && strength >= 9) return actions.find((a) => a.type === 'bid' && a.value === next) ?? null;
      return actions.find((a) => a.type === 'pass') ?? null;
    }
    if (view.currentBid !== null && strength >= 10) return actions.find((a) => a.type === 'hold') ?? null;
    return actions.find((a) => a.type === 'pass') ?? null;
  }
  if (view.phase === 'skat-decision') {
    return handStrength(view) >= 10
      ? actions.find((a) => a.type === 'play-hand') ?? actions[0] ?? null
      : actions.find((a) => a.type === 'pickup-skat') ?? actions[0] ?? null;
  }
  if (view.phase === 'declaring') return actions.find((a) => a.type === 'declare') ?? null;
  if (view.phase === 'discarding') {
    return actions.find((a) => a.type === 'discard' && a.cards.every((card) => rankOf(card) !== 'J')) ?? actions[0] ?? null;
  }
  if (view.phase === 'playing') {
    const playable = actions.filter((a): a is Extract<GameAction, { type: 'play' }> => a.type === 'play');
    if (view.isDeclarer) {
      const ace = playable.find((a) => rankOf(a.card) === 'A');
      if (ace !== undefined) return ace;
    }
    return playable.find((a) => rankOf(a.card) === '7') ?? playable[0] ?? null;
  }
  return null;
}

/** Easy is random; normal and strong use conservative, hand-aware decisions. */
export function botAction(game: GameState, role: Role, rand: () => number, level: BotLevel = 'easy'): GameAction {
  const view = botViewOf(game, role);
  if (level !== 'easy') {
    const strategic = strategicAction(view);
    if (strategic !== null) return strategic;
  }
  if (view.phase !== 'bidding') return pickOne(view.actions, rand);
  const pass = view.actions.find((a) => a.type === 'pass');
  if (pass !== undefined && rand() < PASS_PROBABILITY) return pass;
  const pool = view.actions.filter((a) => a.type === 'bid' || a.type === 'hold' || a.type === 'claim');
  return pickOne(pool.length > 0 ? pool : view.actions, rand);
}

/** Lets the bot whose turn it is act once; null means a human must act or the table waits. */
export function botStep(s: TableState, ctx: () => Ctx, rand: () => number): TableState | null {
  const game = s.game;
  if (game === null || game.engine.phase === 'finished' || game.engine.turn === null) return null;
  const role = game.engine.turn;
  const playerId = game.roles[role];
  if (!s.players.some((p) => p.id === playerId && p.isBot)) return null;
  const action = botAction(game.engine, role, rand, s.botLevel);
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

export { botViewOf } from './bot/knowledge';
