// Normal card play (docs/14-bots.md §5): rule-based, maximizes the team's card points;
// in Null the declarer avoids tricks and the defenders try to force one on the declarer.

import {
  cardStrength,
  effectiveSuit,
  isTrump,
  suitOf,
  trickWinner,
  type CardId,
  type PlayMode,
  type Role,
} from '../../engine';
import {
  cheapest,
  highestPoints,
  isTopRemaining,
  laterRoles,
  modeOfView,
  outstanding,
  partnerOf,
  remainingTrumps,
  sortBy,
  strongest,
  trickPoints,
  weakest,
  winsNow,
} from './cardsLeft';
import type { PlayView } from './knowledge';
import { VALUABLE_TRICK } from './tuning';

export function heuristicCard(view: PlayView): CardId {
  const playable = view.playable;
  const only = playable[0];
  if (only === undefined) throw new Error('no playable card');
  if (playable.length === 1) return only;
  const mode = modeOfView(view);
  if (mode.kind === 'null') {
    return view.role === view.declarer ? nullDeclarer(view, mode) : nullDefender(view, mode);
  }
  return view.role === view.declarer ? trumpDeclarer(view, mode) : trumpDefender(view, mode);
}

// ---------------------------------------------------------------- suit / grand

/** Wins now and cannot be beaten by a player still to come (as far as the bot can tell). */
function safeWinners(view: PlayView, mode: PlayMode, out: readonly CardId[]): CardId[] {
  const later = laterRoles(view).filter((r) => view.declarer === null || !sameSide(view, r));
  return view.playable.filter((c) => {
    if (!winsNow(c, view)) return false;
    if (later.length === 0) return true;
    if (!isTopRemaining(c, view, out)) return false;
    if (isTrump(c, mode)) return true;
    // A later opponent who is out of the led suit may trump it.
    const suit = effectiveSuit(c, mode);
    return later.every((r) => !view.voids[r].includes(suit) || view.voids[r].includes('trump'));
  });
}

function sameSide(view: PlayView, other: Role): boolean {
  const declarer = view.declarer;
  if (declarer === null) return false;
  return (view.role === declarer) === (other === declarer);
}

function sideSuitsBy(view: PlayView, mode: PlayMode, longest: boolean): CardId[] {
  const side = view.playable.filter((c) => !isTrump(c, mode));
  if (side.length === 0) return [];
  const count = (c: CardId): number => side.filter((d) => suitOf(d) === suitOf(c)).length;
  const target = longest ? Math.max(...side.map(count)) : Math.min(...side.map(count));
  return side.filter((c) => count(c) === target);
}

function followCheap(view: PlayView, mode: PlayMode): CardId {
  const led = view.trick.plays[0];
  const following = led !== undefined && view.playable.some((c) => effectiveSuit(c, mode) === effectiveSuit(led.card, mode));
  if (following) return cheapest(view.playable, mode);
  const short = sideSuitsBy(view, mode, false);
  return cheapest(short.length > 0 ? short : view.playable, mode);
}

function trumpDeclarer(view: PlayView, mode: PlayMode): CardId {
  const out = outstanding(view);
  if (view.trick.plays.length === 0) {
    const trumps = view.playable.filter((c) => isTrump(c, mode));
    const outside = remainingTrumps(view, out);
    const top = trumps.length > 0 ? strongest(trumps, mode) : null;
    if (outside > 0 && top !== null && isTopRemaining(top, view, out)) return top;
    if (outside > 0 && trumps.length >= outside + 2) return weakest(trumps, mode);
    const sideWinner = view.playable.find((c) => !isTrump(c, mode) && isTopRemaining(c, view, out));
    if (sideWinner !== undefined) return sideWinner;
    const short = sideSuitsBy(view, mode, false);
    return short.length > 0 ? weakest(short, mode) : weakest(view.playable, mode);
  }
  const safe = safeWinners(view, mode, out);
  const points = trickPoints(view);
  if (safe.length > 0) return points >= VALUABLE_TRICK ? highestPoints(safe, mode) : cheapest(safe, mode);
  const winners = view.playable.filter((c) => winsNow(c, view));
  if (winners.length > 0 && points >= VALUABLE_TRICK) return strongest(winners, mode);
  return followCheap(view, mode);
}

function trumpDefender(view: PlayView, mode: PlayMode): CardId {
  const out = outstanding(view);
  const partner = partnerOf(view);
  const declarer = view.declarer;
  if (view.trick.plays.length === 0) return defenderLead(view, mode, out);
  const winner = trickWinner(view.trick, mode);
  const declarerPlayed = view.trick.plays.some((p) => p.role === declarer);
  if (winner === partner) {
    const partnerCard = view.trick.plays.find((p) => p.role === partner)?.card;
    const led = view.trick.plays[0]?.card;
    const declarerMayTrump =
      declarer !== null && led !== undefined && !isTrump(led, mode) &&
      view.voids[declarer].includes(effectiveSuit(led, mode)) && !view.voids[declarer].includes('trump');
    const safe =
      declarerPlayed ||
      (partnerCard !== undefined && isTopRemaining(partnerCard, view, out) && !declarerMayTrump);
    if (safe) return schmieren(view, mode);
  }
  const safe = safeWinners(view, mode, out);
  if (safe.length > 0) return highestPoints(safe, mode);
  return followCheap(view, mode);
}

/** Gives the partner as many points as possible, keeping trump aces/tens when it can. */
function schmieren(view: PlayView, mode: PlayMode): CardId {
  const keep = view.playable.filter((c) => !(isTrump(c, mode) && cardStrength(c, mode) >= 110 && !c.endsWith('J')));
  return highestPoints(keep.length > 0 ? keep : view.playable, mode);
}

function defenderLead(view: PlayView, mode: PlayMode, out: readonly CardId[]): CardId {
  const side = view.playable.filter((c) => !isTrump(c, mode));
  const aceLike = side.find((c) => isTopRemaining(c, view, out) && c.endsWith('A'));
  if (aceLike !== undefined) return aceLike;
  const declarer = view.declarer;
  const partner = partnerOf(view);
  if (declarer !== null && partner !== null) {
    const forceTrump = side.filter((c) => {
      const s = effectiveSuit(c, mode);
      return view.voids[declarer].includes(s) && !view.voids[partner].includes(s);
    });
    if (forceTrump.length > 0) return weakest(forceTrump, mode);
  }
  const longest = sideSuitsBy(view, mode, true);
  if (longest.length > 0) return weakest(longest, mode);
  return weakest(view.playable, mode);
}

// ---------------------------------------------------------------- null

function nullDeclarer(view: PlayView, mode: PlayMode): CardId {
  if (view.trick.plays.length > 0) {
    const losers = view.playable.filter((c) => !winsNow(c, view));
    return losers.length > 0 ? strongest(losers, mode) : strongest(view.playable, mode);
  }
  const out = outstanding(view);
  // Best lead: nobody can play under it, but somebody holds a higher card of the suit.
  return sortBy(view.playable, (c) => {
    const inSuit = out.filter((o) => suitOf(o) === suitOf(c));
    const lower = inSuit.filter((o) => cardStrength(o, mode) < cardStrength(c, mode)).length;
    const higher = inSuit.length - lower;
    return lower * 100 + (higher === 0 ? 50 : 0) - higher + cardStrength(c, mode) / 100;
  });
}

function nullDefender(view: PlayView, mode: PlayMode): CardId {
  const declarer = view.declarer;
  if (declarer === null) return weakest(view.playable, mode);
  const plays = view.trick.plays;
  if (plays.length === 0) return nullDefenderLead(view, mode, declarer);
  const declarerPlay = plays.find((p) => p.role === declarer);
  const led = plays[0];
  const following = led !== undefined && view.playable.every((c) => suitOf(c) === suitOf(led.card));
  if (declarerPlay !== undefined) {
    if (trickWinner(view.trick, mode) === declarer) {
      // Keep the declarer on top: the highest card that stays below, else get rid of a high card.
      const under = view.playable.filter((c) => !winsNow(c, view));
      if (under.length > 0) return strongest(under, mode);
      return weakest(view.playable, mode);
    }
    return following ? weakest(view.playable, mode) : strongest(view.playable, mode);
  }
  // The declarer still has to play: stay low to leave room above.
  return following ? weakest(view.playable, mode) : strongest(view.playable, mode);
}

function nullDefenderLead(view: PlayView, mode: PlayMode, declarer: Role): CardId {
  const open = view.openHands[declarer];
  const out = outstanding(view);
  return sortBy(view.playable, (c) => {
    const s = suitOf(c);
    if (view.voids[declarer].includes(s)) return 1000 + cardStrength(c, mode);
    const myLowest = Math.min(...view.playable.filter((d) => suitOf(d) === s).map((d) => cardStrength(d, mode)));
    const isMyLowest = cardStrength(c, mode) === myLowest ? 0 : 50;
    if (open !== undefined) {
      const theirs = open.filter((d) => suitOf(d) === s).map((d) => cardStrength(d, mode));
      if (theirs.length === 0) return 900 + cardStrength(c, mode);
      const good = Math.min(...theirs) > cardStrength(c, mode) ? 0 : 200;
      return good + isMyLowest + cardStrength(c, mode);
    }
    const unknownInSuit = out.filter((o) => suitOf(o) === s).length;
    return isMyLowest - unknownInSuit * 5 + cardStrength(c, mode);
  });
}
