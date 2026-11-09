// What a bot in one seat may know (docs/bots.md §2). `botViewOf` is the only bot function that
// reads a GameState; every strategy works on these views, so bots cannot use hidden cards.

import {
  effectiveSuit,
  enumerateActions,
  getLegal,
  playModeOf,
  ROLES,
  type BiddingState,
  type CardId,
  type CompletedTrick,
  type Declaration,
  type GameAction,
  type GamePhase,
  type GameState,
  type Legal,
  type PlayMode,
  type Role,
  type Suit,
  type Trick,
} from '../../engine';

export type EffectiveSuit = Suit | 'trump';
export type Voids = Readonly<Record<Role, readonly EffectiveSuit[]>>;

/** The part of a seat's knowledge that card play needs. Simulations build these as well. */
export interface PlayView {
  readonly role: Role;
  /** A Ramsch: no declarer, only Jacks are trump (Grand order), skat-rules §12. */
  readonly ramsch: boolean;
  readonly hand: readonly CardId[];
  readonly declarer: Role | null;
  readonly declaration: Declaration | null;
  readonly trick: Trick;
  readonly tricks: readonly CompletedTrick[];
  /** Cards of open (ouvert) hands of other players; own hand is never listed here. */
  readonly openHands: Partial<Record<Role, readonly CardId[]>>;
  /** The declarer after picking up: the two discarded cards (they count for the declarer). */
  readonly ownDiscard: readonly CardId[];
  readonly voids: Voids;
  readonly playable: readonly CardId[];
}

export interface BotView extends PlayView {
  readonly phase: GamePhase;
  readonly bid: number | null;
  readonly bidding: BiddingState;
  readonly pickedUpSkat: boolean;
  /** The declarer after picking up: the two Skat cards as dealt. */
  readonly ownSkat: readonly CardId[];
  readonly handCounts: Readonly<Record<Role, number>>;
  readonly legal: Legal;
  readonly actions: readonly GameAction[];
}

const NO_VOIDS: Voids = { forehand: [], middlehand: [], hindhand: [] };

/** Suits each role has shown to be out of, from failing to follow the led suit. */
export function voidsOf(tricks: readonly Trick[], mode: PlayMode | null): Voids {
  if (mode === null) return NO_VOIDS;
  const found: Record<Role, EffectiveSuit[]> = { forehand: [], middlehand: [], hindhand: [] };
  for (const trick of tricks) {
    const lead = trick.plays[0];
    if (lead === undefined) continue;
    const led = effectiveSuit(lead.card, mode);
    for (const play of trick.plays.slice(1)) {
      const list = found[play.role];
      if (effectiveSuit(play.card, mode) !== led && !list.includes(led)) list.push(led);
    }
  }
  return found;
}

function openHandsOf(game: GameState, role: Role): Partial<Record<Role, readonly CardId[]>> {
  const declarer = game.declarer;
  if (declarer === null || declarer === role || game.phase !== 'playing') return {};
  if (game.declaration?.ouvert !== true) return {};
  return { [declarer]: [...game.hands[declarer]] };
}

/** Projects a full game onto what `role` legitimately knows. */
export function botViewOf(game: GameState, role: Role): BotView {
  const isDeclarer = game.declarer === role;
  const legal = getLegal(game, role);
  return {
    role,
    ramsch: game.ramsch,
    phase: game.phase,
    hand: [...game.hands[role]],
    declarer: game.declarer,
    declaration: game.declaration,
    bid: game.bid,
    bidding: game.bidding,
    pickedUpSkat: game.pickedUpSkat,
    ownSkat: isDeclarer && game.pickedUpSkat ? [...game.skat] : [],
    ownDiscard: isDeclarer && game.pickedUpSkat ? [...game.discarded] : [],
    trick: game.trick,
    tricks: game.tricks,
    openHands: openHandsOf(game, role),
    handCounts: {
      forehand: game.hands.forehand.length,
      middlehand: game.hands.middlehand.length,
      hindhand: game.hands.hindhand.length,
    },
    voids: voidsOf([...game.tricks, game.trick], playModeOf(game)),
    legal,
    playable: legal.playableCards ?? [],
    actions: enumerateActions(game, role),
  };
}

export function otherRoles(role: Role): Role[] {
  return ROLES.filter((r) => r !== role);
}
