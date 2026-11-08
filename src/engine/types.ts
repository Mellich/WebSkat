// Core types of one Skat game (docs/engine.md). Everything here is JSON-serializable.

export type Suit = 'C' | 'S' | 'H' | 'D';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type CardId = `${Suit}${Rank}`;

export type Role = 'forehand' | 'middlehand' | 'hindhand';
export const ROLES: readonly Role[] = ['forehand', 'middlehand', 'hindhand'];

export type Announce = 'none' | 'schneider' | 'schwarz';

export type Declaration =
  | {
      readonly kind: 'suit';
      readonly trump: Suit;
      readonly hand: boolean;
      readonly announce: Announce;
      readonly ouvert: boolean;
    }
  | { readonly kind: 'grand'; readonly hand: boolean; readonly announce: Announce; readonly ouvert: boolean }
  | { readonly kind: 'null'; readonly hand: boolean; readonly ouvert: boolean };

/** Declarations that have a multiplier (suit and grand). Null has fixed values instead. */
export type TrumpDeclaration = Extract<Declaration, { readonly kind: 'suit' | 'grand' }>;

export type GamePhase =
  | 'bidding'
  | 'skat-decision'
  | 'discarding'
  | 'declaring'
  | 'playing'
  | 'finished';

export type BidEvent =
  | { readonly role: Role; readonly type: 'bid'; readonly value: number }
  | { readonly role: Role; readonly type: 'hold' }
  | { readonly role: Role; readonly type: 'pass' }
  | { readonly role: Role; readonly type: 'claim' };

export type BiddingStage = 1 | 2 | 'claim' | 'done' | 'passed-in';

export interface BiddingState {
  readonly stage: BiddingStage;
  readonly caller: Role; // stage 1: middlehand; stage 2: hindhand; 'claim': forehand; 'done': the declarer
  readonly listener: Role; // stage 1: forehand;  stage 2: stage-1 survivor
  readonly awaiting: 'caller' | 'listener';
  readonly currentBid: number | null;
  readonly history: readonly BidEvent[];
}

export interface TrickPlay {
  readonly role: Role;
  readonly card: CardId;
}
export interface Trick {
  readonly leader: Role;
  readonly plays: readonly TrickPlay[];
}
export interface CompletedTrick extends Trick {
  readonly winner: Role;
}

export type GameAction =
  | { readonly type: 'bid'; readonly value: number }
  | { readonly type: 'hold' }
  | { readonly type: 'pass' }
  | { readonly type: 'claim' }
  | { readonly type: 'pickup-skat' }
  | { readonly type: 'play-hand' }
  | { readonly type: 'discard'; readonly cards: readonly [CardId, CardId] }
  | { readonly type: 'declare'; readonly declaration: Declaration }
  | { readonly type: 'play'; readonly card: CardId };

/** The actions that belong to the bidding phase. */
export type BidAction = Extract<GameAction, { readonly type: 'bid' | 'hold' | 'pass' | 'claim' }>;

export interface GameState {
  readonly phase: GamePhase;
  readonly hands: Readonly<Record<Role, readonly CardId[]>>; // current cards in hand
  readonly initialHands: Readonly<Record<Role, readonly CardId[]>>; // as dealt (10 each)
  readonly skat: readonly CardId[]; // as dealt (2), never changes
  readonly bidding: BiddingState;
  readonly declarer: Role | null;
  readonly bid: number | null;
  readonly pickedUpSkat: boolean;
  readonly discarded: readonly CardId[]; // [] until discarded
  readonly declaration: Declaration | null;
  readonly trick: Trick; // current (possibly empty) trick
  readonly tricks: readonly CompletedTrick[]; // completed tricks, in order
  readonly turn: Role | null; // who must act now
  readonly result: GameResult | null; // set when phase = 'finished'
}

export type GameResult =
  | { readonly kind: 'passed-in' }
  | {
      readonly kind: 'played';
      readonly declarer: Role;
      readonly bid: number;
      readonly declaration: Declaration;
      readonly spitzen: { readonly with: boolean; readonly count: number } | null; // null for Null
      readonly declarerPoints: number; // 0 for Null
      readonly defenderPoints: number; // 0 for Null
      readonly declarerTricks: number;
      readonly defenderTricks: number;
      readonly schneider: boolean; // schneiderAchieved (false for Null)
      readonly schwarz: boolean; // schwarzAchieved   (false for Null)
      readonly base: number; // 9..12, 24, or the Null value
      readonly multiplier: number | null; // null for Null
      readonly gameValue: number;
      readonly playedWon: boolean;
      readonly overbid: boolean;
      readonly won: boolean;
      readonly loseValue: number | null; // value that is doubled when lost; null when won
      readonly declarerScore: number; // standard counting, see skat-rules §10.5
    };

export type GameErrorCode =
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'ILLEGAL_BID'
  | 'CANNOT_HOLD'
  | 'INVALID_DISCARD'
  | 'INVALID_DECLARATION'
  | 'ILLEGAL_CARD'
  | 'UNKNOWN_CARD';

export type Result<T, E extends string = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: E; readonly message: string } };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends string>(code: E, message: string): Result<never, E> {
  return { ok: false, error: { code, message } };
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
