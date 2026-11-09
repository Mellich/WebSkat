import { sumPoints } from './cards';
import { countSpitzen } from './spitzen';
import { modeOf } from './trump';
import { scoreRamsch } from './ramsch';
import type { Declaration, GameResult, GameState, TrumpDeclaration } from './types';
import { baseValue, gameMultiplier, nullValue } from './values';

const TOTAL_POINTS = 120;

export interface ScoreInput {
  readonly declaration: Declaration;
  readonly bid: number;
  readonly spitzen: number; // spitzen count, 0 for Null
  readonly declarerPoints: number;
  readonly declarerTricks: number;
}

export interface ScoreComputation {
  readonly base: number;
  readonly multiplier: number | null;
  readonly gameValue: number;
  readonly schneider: boolean;
  readonly schwarz: boolean;
  readonly playedWon: boolean;
  readonly overbid: boolean;
  readonly won: boolean;
  readonly loseValue: number | null;
  readonly declarerScore: number;
}

/** Win/loss, overbid and standard declarer score (skat-rules §10.3–§10.5). */
function settle(
  gameValue: number,
  roundingBase: number | null,
  bid: number,
  playedWon: boolean,
): Pick<ScoreComputation, 'overbid' | 'won' | 'loseValue' | 'declarerScore'> {
  const overbid = gameValue < bid;
  const won = playedWon && !overbid;
  const lostValue =
    overbid && roundingBase !== null ? Math.ceil(bid / roundingBase) * roundingBase : gameValue;
  return {
    overbid,
    won,
    loseValue: won ? null : lostValue,
    declarerScore: won ? gameValue : -2 * lostValue,
  };
}

function suitPlayedWon(d: TrumpDeclaration, i: ScoreInput): boolean {
  if (i.declarerPoints < 61) return false;
  if (d.announce !== 'none' && i.declarerPoints < 90) return false;
  if ((d.announce === 'schwarz' || d.ouvert) && i.declarerTricks !== 10) return false;
  return true;
}

export function computeScore(i: ScoreInput): ScoreComputation {
  const d = i.declaration;
  if (d.kind === 'null') {
    const gameValue = nullValue(d);
    const playedWon = i.declarerTricks === 0;
    return {
      base: gameValue,
      multiplier: null,
      gameValue,
      schneider: false,
      schwarz: false,
      playedWon,
      ...settle(gameValue, null, i.bid, playedWon),
    };
  }
  const base = baseValue(d);
  const schneider = i.declarerPoints >= 90 || i.declarerPoints <= 30;
  const schwarz = i.declarerTricks === 10 || i.declarerTricks === 0;
  const multiplier = gameMultiplier(d, i.spitzen, schneider, schwarz);
  const gameValue = base * multiplier;
  const playedWon = suitPlayedWon(d, i);
  return {
    base,
    multiplier,
    gameValue,
    schneider,
    schwarz,
    playedWon,
    ...settle(gameValue, base, i.bid, playedWon),
  };
}

/** Card points the declarer gets from the Skat: the discarded cards after a pick-up, else the Skat. */
export function skatPointsForDeclarer(state: GameState): number {
  return sumPoints(state.pickedUpSkat ? state.discarded : state.skat);
}

/**
 * Scores a finished game. Returns `passed-in` for states that have no declarer, bid or
 * declaration (i.e. games that were never played).
 */
export function scoreGame(state: GameState): GameResult {
  if (state.ramsch) return scoreRamsch(state);
  const { declarer, bid, declaration } = state;
  if (declarer === null || bid === null || declaration === null) {
    return { kind: 'passed-in' };
  }
  const isNull = declaration.kind === 'null';
  const declarerWon = state.tricks.filter((t) => t.winner === declarer);
  const declarerTricks = declarerWon.length;
  const defenderTricks = state.tricks.length - declarerTricks;
  const spitzen = countSpitzen([...state.initialHands[declarer], ...state.skat], modeOf(declaration));
  const declarerPoints = isNull
    ? 0
    : sumPoints(declarerWon.flatMap((t) => t.plays.map((p) => p.card))) + skatPointsForDeclarer(state);
  const defenderPoints = isNull ? 0 : TOTAL_POINTS - declarerPoints;
  const score = computeScore({
    declaration,
    bid,
    spitzen: spitzen?.count ?? 0,
    declarerPoints,
    declarerTricks,
  });
  return {
    kind: 'played',
    declarer,
    bid,
    declaration,
    spitzen,
    declarerPoints,
    defenderPoints,
    declarerTricks,
    defenderTricks,
    ...score,
  };
}
