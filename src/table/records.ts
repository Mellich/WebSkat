// Builds the GameRecord of a finished game with both scoring systems (docs/statistics.md §1, skat-rules §10.5–10.6).

import { assertNever, type Declaration, type GameResult } from '../engine';
import {
  SUIT_LABELS,
  type ActiveGame,
  type Ctx,
  type GameKindLabel,
  type GameRecord,
  type PlayerId,
  type TableState,
} from './types';

type RecordBase = Pick<
  GameRecord,
  'id' | 'number' | 'timestamp' | 'tableSize' | 'dealerId' | 'roles' | 'sittingOut' | 'names'
>;
type PlayedResult = Extract<GameResult, { kind: 'played' }>;

/** Seeger–Fabian bonus for every non-declarer when the declarer loses (decision D6 for N ≥ 5). */
export function seegerBonus(seats: number): number {
  switch (seats) {
    case 3:
      return 40;
    case 4:
      return 30;
    case 5:
      return 24;
    case 6:
      return 20;
    default:
      return 0;
  }
}

export function gameKindOf(d: Declaration): GameKindLabel {
  switch (d.kind) {
    case 'suit':
      return SUIT_LABELS[d.trump];
    case 'grand':
      return 'grand';
    case 'null':
      return 'null';
    default:
      return assertNever(d);
  }
}

function zeroes(ids: readonly PlayerId[]): Record<PlayerId, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

function scoresFor(
  ids: readonly PlayerId[],
  declarerId: PlayerId,
  result: PlayedResult,
  seats: number,
): GameRecord['scores'] {
  const standard = { ...zeroes(ids), [declarerId]: result.declarerScore };
  if (result.won) {
    return { standard, seeger: { ...zeroes(ids), [declarerId]: result.gameValue + 50 } };
  }
  const bonus = seegerBonus(seats);
  const seeger = Object.fromEntries(
    ids.map((id) => [id, id === declarerId ? result.declarerScore - 50 : bonus]),
  );
  return { standard, seeger };
}

function passedInRecord(base: RecordBase, ids: readonly PlayerId[]): GameRecord {
  return {
    ...base,
    outcome: 'passed-in',
    declarerId: null,
    bid: null,
    game: null,
    hand: false,
    ouvert: false,
    announce: 'none',
    spitzenWith: null,
    spitzenCount: null,
    multiplier: null,
    gameValue: null,
    declarerPoints: null,
    defenderPoints: null,
    declarerTricks: null,
    schneider: false,
    schwarz: false,
    overbid: false,
    won: false,
    scores: { standard: zeroes(ids), seeger: zeroes(ids) },
  };
}

/** Creates the record of a finished game. The game must have a result. */
export function makeRecord(table: TableState, game: ActiveGame, ctx: Ctx): GameRecord {
  const result = game.engine.result;
  if (result === null) {
    throw new Error('makeRecord needs a finished game');
  }
  const ids = table.players.map((p) => p.id);
  const base: RecordBase = {
    id: `${table.key}-${String(game.number)}`,
    number: game.number,
    timestamp: ctx.now,
    tableSize: game.seatsAtDeal,
    dealerId: game.dealerId,
    roles: game.roles,
    sittingOut: game.sittingOut,
    names: Object.fromEntries(table.players.map((p) => [p.id, p.name])),
  };
  if (result.kind === 'passed-in') {
    return passedInRecord(base, ids);
  }
  const declarerId = game.roles[result.declarer];
  const d = result.declaration;
  const isNull = d.kind === 'null';
  return {
    ...base,
    outcome: 'played',
    declarerId,
    bid: result.bid,
    game: gameKindOf(d),
    hand: d.hand,
    ouvert: d.ouvert,
    announce: d.kind === 'null' ? 'none' : d.announce,
    spitzenWith: result.spitzen?.with ?? null,
    spitzenCount: result.spitzen?.count ?? null,
    multiplier: result.multiplier,
    gameValue: result.gameValue,
    declarerPoints: isNull ? null : result.declarerPoints,
    defenderPoints: isNull ? null : result.defenderPoints,
    declarerTricks: result.declarerTricks,
    schneider: result.schneider,
    schwarz: result.schwarz,
    overbid: result.overbid,
    won: result.won,
    scores: scoresFor(ids, declarerId, result, game.seatsAtDeal),
  };
}
