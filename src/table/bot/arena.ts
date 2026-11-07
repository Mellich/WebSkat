// Test support: plays engine-only games between bot levels (docs/14-bots.md §8).
// Not exported from the table index.

import { applyAction, mulberry32, newGame, ROLES, type GameState, type Role } from '../../engine';
import { seegerBonus } from '../records';
import type { BotLevel } from '../types';
import { botAction } from './index';

export interface ArenaGame {
  readonly state: GameState;
  /** Seeger score per role for this game (0 for everybody when passed in). */
  readonly seeger: Readonly<Record<Role, number>>;
}

export function playGame(seed: number, levels: Readonly<Record<Role, BotLevel>>, botSeed = seed): ArenaGame {
  const rand = mulberry32(botSeed);
  let state = newGame(seed);
  for (let guard = 0; state.phase !== 'finished' && guard < 200; guard++) {
    const role = state.turn;
    if (role === null) break;
    const result = applyAction(state, role, botAction(state, role, levels[role], rand));
    if (!result.ok) throw new Error(`arena: ${result.error.message}`);
    state = result.value;
  }
  const seeger: Record<Role, number> = { forehand: 0, middlehand: 0, hindhand: 0 };
  const r = state.result;
  if (r?.kind === 'played') {
    for (const role of ROLES) {
      if (role === r.declarer) seeger[role] = r.declarerScore + (r.won ? 50 : -50);
      else seeger[role] = r.won ? 0 : seegerBonus(3);
    }
  }
  return { state, seeger };
}

export interface MatchResult {
  /** Average Seeger score per game of the single seat played by `solo`. */
  readonly soloAverage: number;
  /** Average Seeger score per game of the single seat played by `rest` (in the mirrored games). */
  readonly restAverage: number;
  /** Declarer games won / played by the `solo` level while sitting alone. */
  readonly soloDeclarerWon: number;
  readonly soloDeclarerGames: number;
}

/**
 * For each deal and seat: `solo` alone against two `rest` bots, then `rest` alone against two
 * `solo` bots in the same seat. Compares the lone seat's average score.
 */
export function match(solo: BotLevel, rest: BotLevel, deals: number, firstSeed = 1): MatchResult {
  let soloSum = 0;
  let restSum = 0;
  let games = 0;
  let declWon = 0;
  let declGames = 0;
  for (let d = 0; d < deals; d++) {
    const seed = firstSeed + d * 7919;
    for (const seat of ROLES) {
      const a = playGame(seed, levelsWith(seat, solo, rest));
      const b = playGame(seed, levelsWith(seat, rest, solo));
      soloSum += a.seeger[seat];
      restSum += b.seeger[seat];
      games++;
      const r = a.state.result;
      if (r?.kind === 'played' && r.declarer === seat) {
        declGames++;
        if (r.won) declWon++;
      }
    }
  }
  return { soloAverage: soloSum / games, restAverage: restSum / games, soloDeclarerWon: declWon, soloDeclarerGames: declGames };
}

function levelsWith(seat: Role, alone: BotLevel, others: BotLevel): Record<Role, BotLevel> {
  return {
    forehand: seat === 'forehand' ? alone : others,
    middlehand: seat === 'middlehand' ? alone : others,
    hindhand: seat === 'hindhand' ? alone : others,
  };
}

/** Reads an environment flag in Node test runs; false in other environments. */
export function envFlag(name: string): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const value = env?.[name];
  return value !== undefined && value !== '' && value !== '0';
}

/** Milliseconds from a monotonic clock (tests only). */
export function nowMs(): number {
  return (globalThis as unknown as { performance: { now(): number } }).performance.now();
}
