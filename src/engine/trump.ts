import { rankOf, suitOf } from './cards';
import type { CardId, Declaration, Rank, Role, Suit, Trick } from './types';
import { assertNever } from './types';

export type PlayMode =
  | { readonly kind: 'suit'; readonly trump: Suit }
  | { readonly kind: 'grand' }
  | { readonly kind: 'null' };

export function modeOf(decl: Declaration): PlayMode {
  switch (decl.kind) {
    case 'suit':
      return { kind: 'suit', trump: decl.trump };
    case 'grand':
      return { kind: 'grand' };
    case 'null':
      return { kind: 'null' };
    default:
      return assertNever(decl);
  }
}

export function isTrump(c: CardId, mode: PlayMode): boolean {
  switch (mode.kind) {
    case 'suit':
      return rankOf(c) === 'J' || suitOf(c) === mode.trump;
    case 'grand':
      return rankOf(c) === 'J';
    case 'null':
      return false;
    default:
      return assertNever(mode);
  }
}

export function effectiveSuit(c: CardId, mode: PlayMode): Suit | 'trump' {
  return isTrump(c, mode) ? 'trump' : suitOf(c);
}

const JACK_STRENGTH: Readonly<Record<Suit, number>> = { C: 200, S: 199, H: 198, D: 197 };
const SUIT_STRENGTH: Readonly<Record<Exclude<Rank, 'J'>, number>> = {
  A: 111,
  '10': 110,
  K: 104,
  Q: 103,
  '9': 100,
  '8': 99,
  '7': 98,
};
const NULL_STRENGTH: Readonly<Record<Rank, number>> = {
  A: 8,
  K: 7,
  Q: 6,
  J: 5,
  '10': 4,
  '9': 3,
  '8': 2,
  '7': 1,
};

/** Higher wins within the same effective suit. Only meaningful for comparable cards. */
export function cardStrength(c: CardId, mode: PlayMode): number {
  const rank = rankOf(c);
  if (mode.kind === 'null') return NULL_STRENGTH[rank];
  if (rank === 'J') return JACK_STRENGTH[suitOf(c)];
  return SUIT_STRENGTH[rank];
}

const TRUMP_OFFSET = 1000;

/** Score used to compare plays in one trick; off-suit cards can never win (-1). */
function winningScore(c: CardId, ledSuit: Suit | 'trump', mode: PlayMode): number {
  const suit = effectiveSuit(c, mode);
  if (suit === 'trump') return TRUMP_OFFSET + cardStrength(c, mode);
  return suit === ledSuit ? cardStrength(c, mode) : -1;
}

/** Empty trick: returns the leader (there is no winner yet). */
export function trickWinner(trick: Trick, mode: PlayMode): Role {
  const lead = trick.plays[0];
  if (lead === undefined) return trick.leader;
  const ledSuit = effectiveSuit(lead.card, mode);
  let winner = lead;
  for (const play of trick.plays) {
    if (winningScore(play.card, ledSuit, mode) > winningScore(winner.card, ledSuit, mode)) {
      winner = play;
    }
  }
  return winner.role;
}

/** Cards the player may play: all cards when leading, otherwise follow suit if possible. */
export function legalCards(
  hand: readonly CardId[],
  trick: Trick,
  mode: PlayMode,
): CardId[] {
  const lead = trick.plays[0];
  if (lead === undefined) return [...hand];
  const ledSuit = effectiveSuit(lead.card, mode);
  const followers = hand.filter((c) => effectiveSuit(c, mode) === ledSuit);
  return followers.length > 0 ? followers : [...hand];
}
