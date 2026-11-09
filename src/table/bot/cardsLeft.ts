// Card bookkeeping on a PlayView: which cards are still out, which card is the top one, teams.

import {
  ALL_CARDS,
  cardPoints,
  cardStrength,
  effectiveSuit,
  isTrump,
  modeOf,
  nextRole,
  trickWinner,
  type CardId,
  type PlayMode,
  type Role,
} from '../../engine';
import type { EffectiveSuit, PlayView } from './knowledge';

export function modeOfView(view: PlayView): PlayMode {
  if (view.ramsch) return { kind: 'grand' };
  if (view.declaration === null) throw new Error('bot card play needs a declaration');
  return modeOf(view.declaration);
}

export function playedCards(view: PlayView): CardId[] {
  return [...view.tricks, view.trick].flatMap((t) => t.plays.map((p) => p.card));
}

/**
 * Cards that other players may still play: not in own hand, not played, not known to lie in the
 * Skat. Open hands are included (they are still to be played).
 */
export function outstanding(view: PlayView): CardId[] {
  const gone = new Set<CardId>([...view.hand, ...playedCards(view), ...view.ownDiscard]);
  return ALL_CARDS.filter((c) => !gone.has(c));
}

export function sameSuit(a: CardId, s: EffectiveSuit, mode: PlayMode): boolean {
  return effectiveSuit(a, mode) === s;
}

/** True when no outstanding card of the same effective suit beats `card`. */
export function isTopRemaining(card: CardId, view: PlayView, out: readonly CardId[] = outstanding(view)): boolean {
  const mode = modeOfView(view);
  const suit = effectiveSuit(card, mode);
  const strength = cardStrength(card, mode);
  return !out.some((c) => effectiveSuit(c, mode) === suit && cardStrength(c, mode) > strength);
}

export function remainingTrumps(view: PlayView, out: readonly CardId[] = outstanding(view)): number {
  const mode = modeOfView(view);
  return out.filter((c) => isTrump(c, mode)).length;
}

export function partnerOf(view: PlayView): Role | null {
  const declarer = view.declarer;
  if (declarer === null || declarer === view.role) return null;
  return [nextRole(view.role), nextRole(nextRole(view.role))].find((r) => r !== declarer) ?? null;
}

export function sameTeam(a: Role, b: Role, declarer: Role): boolean {
  return a === b || (a !== declarer && b !== declarer);
}

/** Roles that still play after the viewer in the current trick. */
export function laterRoles(view: PlayView): Role[] {
  const left = 2 - view.trick.plays.length;
  const roles: Role[] = [];
  let r = view.role;
  for (let i = 0; i < left; i++) {
    r = nextRole(r);
    roles.push(r);
  }
  return roles;
}

export function winsNow(card: CardId, view: PlayView): boolean {
  const mode = modeOfView(view);
  const trick = { leader: view.trick.leader, plays: [...view.trick.plays, { role: view.role, card }] };
  return trickWinner(trick, mode) === view.role;
}

export function trickPoints(view: PlayView): number {
  return view.trick.plays.reduce((sum, p) => sum + cardPoints(p.card), 0);
}

/** Lowest points first, then lowest strength; non-trumps before trumps. */
export function cheapest(cards: readonly CardId[], mode: PlayMode): CardId {
  return sortBy(cards, (c) => (isTrump(c, mode) ? 1000 : 0) + cardPoints(c) * 10 + cardStrength(c, mode) / 1000);
}

export function highestPoints(cards: readonly CardId[], mode: PlayMode): CardId {
  return sortBy(cards, (c) => -(cardPoints(c) * 10 + cardStrength(c, mode) / 1000));
}

export function strongest(cards: readonly CardId[], mode: PlayMode): CardId {
  return sortBy(cards, (c) => -((isTrump(c, mode) ? 1000 : 0) + cardStrength(c, mode)));
}

export function weakest(cards: readonly CardId[], mode: PlayMode): CardId {
  return sortBy(cards, (c) => (isTrump(c, mode) ? 1000 : 0) + cardStrength(c, mode));
}

/** The element with the smallest key (first one on ties). Throws on an empty list. */
export function sortBy<T>(items: readonly T[], key: (item: T) => number): T {
  let best: T | undefined;
  let bestKey = Infinity;
  for (const item of items) {
    const k = key(item);
    if (best === undefined || k < bestKey) {
      best = item;
      bestKey = k;
    }
  }
  if (best === undefined) throw new Error('sortBy on an empty list');
  return best;
}
