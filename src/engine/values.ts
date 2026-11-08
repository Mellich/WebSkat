import type { Announce, Declaration, Suit, TrumpDeclaration } from './types';
import { assertNever } from './types';

export const SUIT_BASE: Readonly<Record<Suit, number>> = { C: 12, S: 11, H: 10, D: 9 };
export const GRAND_BASE = 24;

export function nullValue(d: { readonly hand: boolean; readonly ouvert: boolean }): 23 | 35 | 46 | 59 {
  if (d.ouvert) return d.hand ? 59 : 46;
  return d.hand ? 35 : 23;
}

export function baseValue(d: Declaration): number {
  switch (d.kind) {
    case 'suit':
      return SUIT_BASE[d.trump];
    case 'grand':
      return GRAND_BASE;
    case 'null':
      return nullValue(d);
    default:
      return assertNever(d);
  }
}

function computeBidValues(): number[] {
  const values = new Set<number>([23, 35, 46, 59]);
  for (const base of [9, 10, 11, 12]) {
    for (let m = 2; m <= 18; m++) {
      values.add(base * m);
    }
  }
  for (let m = 2; m <= 11; m++) {
    values.add(GRAND_BASE * m);
  }
  return [...values].sort((a, b) => a - b);
}

/** All legal bid values, ascending (skat-rules §4.1). */
export const BID_VALUES: readonly number[] = computeBidValues();

function announceSteps(announce: Announce): number {
  switch (announce) {
    case 'none':
      return 0;
    case 'schneider':
      return 1;
    case 'schwarz':
      return 2;
    default:
      return assertNever(announce);
  }
}

/** Multiplier for suit and grand games (skat-rules §10.2). */
export function gameMultiplier(
  d: TrumpDeclaration,
  spitzen: number,
  schneider: boolean,
  schwarz: boolean,
): number {
  return (
    spitzen +
    1 +
    (d.hand ? 1 : 0) +
    announceSteps(d.announce) +
    (d.ouvert ? 1 : 0) +
    (schneider ? 1 : 0) +
    (schwarz ? 1 : 0)
  );
}

/** Lowest value the game can have: the multiplier without achieved Schneider/Schwarz. */
export function declarationFloorValue(d: Declaration, spitzenCount: number | null): number {
  if (d.kind === 'null') return nullValue(d);
  return baseValue(d) * gameMultiplier(d, spitzenCount ?? 0, false, false);
}
