// Shared test fixtures: the three worked games of skat-rules §10.7 (Seeger vectors). Not in index.ts.

import { newGame, type GameResult, type GameState, type Role } from '../engine';
import type { ActiveGame, TableState } from './types';

/** A finished game for the given table, dealt to the given roles. */
export function finishedGame(
  table: TableState,
  roles: Readonly<Record<Role, string>>,
  result: GameResult,
  number: number,
  sittingOut: readonly string[] = [],
): ActiveGame {
  const engine: GameState = { ...newGame(1), phase: 'finished', turn: null, result };
  return {
    number,
    engine,
    roles,
    sittingOut,
    dealerId: roles.hindhand,
    seed: 1,
    seatsAtDeal: table.players.length,
    recorded: false,
    bock: false,
  };
}

/** Won Grand not hand, mit 4, Schneider achieved (value 144). */
export const GRAND_144: GameResult = {
  kind: 'played',
  declarer: 'forehand',
  bid: 48,
  declaration: { kind: 'grand', hand: false, announce: 'none', ouvert: false },
  spitzen: { with: true, count: 4 },
  declarerPoints: 100,
  defenderPoints: 20,
  declarerTricks: 8,
  defenderTricks: 2,
  schneider: true,
  schwarz: false,
  base: 24,
  multiplier: 6,
  gameValue: 144,
  playedWon: true,
  overbid: false,
  won: true,
  loseValue: null,
  declarerScore: 144,
};

/** Lost Diamonds ohne 2 (value 27). */
export const DIAMONDS_LOST: GameResult = {
  kind: 'played',
  declarer: 'forehand',
  bid: 18,
  declaration: { kind: 'suit', trump: 'D', hand: false, announce: 'none', ouvert: false },
  spitzen: { with: false, count: 2 },
  declarerPoints: 40,
  defenderPoints: 80,
  declarerTricks: 3,
  defenderTricks: 7,
  schneider: false,
  schwarz: false,
  base: 9,
  multiplier: 3,
  gameValue: 27,
  playedWon: false,
  overbid: false,
  won: false,
  loseValue: 27,
  declarerScore: -54,
};

/** Won Null Ouvert (value 46). */
export const NULL_OUVERT_WON: GameResult = {
  kind: 'played',
  declarer: 'forehand',
  bid: 46,
  declaration: { kind: 'null', hand: false, ouvert: true },
  spitzen: null,
  declarerPoints: 0,
  defenderPoints: 0,
  declarerTricks: 0,
  defenderTricks: 10,
  schneider: false,
  schwarz: false,
  base: 46,
  multiplier: null,
  gameValue: 46,
  playedWon: true,
  overbid: false,
  won: true,
  loseValue: null,
  declarerScore: 46,
};
