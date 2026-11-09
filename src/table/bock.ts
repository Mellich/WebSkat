// Bockrunden (table rule, skat-rules §13): a 60 : 60 game starts Bock games; the counter lives in TableState.

import type { GameResult } from '../engine';

/** Bock games started by one 60 : 60 game (skat-rules §13). */
export const BOCK_GAMES = 3;
/** Factor on the game value part of a Bock game (skat-rules §13). */
export const BOCK_FACTOR = 2;

/** True when this finished result starts new Bock games: a played suit or Grand game at 60 : 60. */
export function triggersBock(result: GameResult): boolean {
  if (result.kind !== 'played') return false;
  if (result.declaration.kind === 'null') return false;
  return result.declarerPoints === 60;
}

/** The counter after one finished game: a Bock game uses one up, a trigger adds three. */
export function nextBockGamesLeft(left: number, wasBock: boolean, triggered: boolean): number {
  const used = wasBock ? 1 : 0;
  const added = triggered ? BOCK_GAMES : 0;
  return Math.max(0, left - used) + added;
}
