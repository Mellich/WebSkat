// Builds the GameState at the first card of a played game or a Ramsch from known cards (analysis).
// Bidding, Kontra/Re and the Skat decision are not replayed: the caller passes their outcome.

import { isCardId } from './cards';
import { initialBidding } from './bidding';
import { validateDeclaration } from './declaration';
import {
  err,
  ok,
  ROLES,
  type CardId,
  type Declaration,
  type DoubleLevel,
  type GameErrorCode,
  type GameState,
  type Result,
  type Role,
} from './types';

export interface PlaySetup {
  readonly hands: Readonly<Record<Role, readonly CardId[]>>; // as dealt, 10 each
  readonly skat: readonly CardId[]; // as dealt, 2
  readonly ramsch: boolean;
  readonly declarer: Role | null; // null exactly when ramsch
  readonly declaration: Declaration | null; // null exactly when ramsch
  readonly bid: number | null; // null exactly when ramsch
  readonly pickedUpSkat: boolean; // false for Hand games and Ramsch
  readonly discarded: readonly CardId[]; // 2 cards when pickedUpSkat, else []
  readonly doubling: DoubleLevel;
}

/** All 32 cards exactly once, each a valid card id (10 per hand, 2 in the Skat). */
function checkCards(setup: PlaySetup): Result<never, GameErrorCode> | null {
  const all = [...ROLES.flatMap((role) => setup.hands[role]), ...setup.skat];
  const sizes = ROLES.every((role) => setup.hands[role].length === 10) && setup.skat.length === 2;
  if (!sizes || !all.every((c) => isCardId(c)) || new Set(all).size !== all.length) {
    return err('UNKNOWN_CARD', 'Each player needs 10 different cards and the Skat 2 cards of the deck.');
  }
  return null;
}

/** The discard of a picked-up Skat: two different cards from the declarer's hand and the Skat. */
function checkDiscard(setup: PlaySetup, declarer: Role): Result<never, GameErrorCode> | null {
  if (!setup.pickedUpSkat) {
    return setup.discarded.length === 0 ? null : err('INVALID_DISCARD', 'Without picking up the Skat, nothing is discarded.');
  }
  const [a, b] = setup.discarded;
  const pool = [...setup.hands[declarer], ...setup.skat];
  if (setup.discarded.length !== 2 || a === b || a === undefined || b === undefined) {
    return err('INVALID_DISCARD', 'Discard two different cards.');
  }
  if (!pool.includes(a) || !pool.includes(b)) {
    return err('INVALID_DISCARD', 'Discard two cards from your hand or the Skat.');
  }
  return null;
}

/** Validates the setup and returns the GameState at the first card. Never throws. */
export function playingStateFrom(setup: PlaySetup): Result<GameState, GameErrorCode> {
  const cardError = checkCards(setup);
  if (cardError !== null) {
    return cardError;
  }
  const { ramsch, declarer, declaration, bid, pickedUpSkat, discarded, doubling } = setup;
  if (ramsch !== (declarer === null) || ramsch !== (declaration === null) || ramsch !== (bid === null)) {
    return err('INVALID_DECLARATION', 'Declarer, declaration and bid must all be empty exactly in a Ramsch.');
  }
  if (ramsch && (pickedUpSkat || discarded.length > 0 || doubling !== 1)) {
    return err('INVALID_DECLARATION', 'A Ramsch has no Skat, discard or doubling.');
  }

  let validDeclaration: Declaration | null = null;
  if (declaration !== null) {
    const checked = validateDeclaration(declaration, !pickedUpSkat);
    if (!checked.ok) {
      return checked;
    }
    validDeclaration = checked.value;
  }

  if (declarer === null) {
    if (pickedUpSkat || discarded.length > 0) {
      return err('INVALID_DISCARD', 'A Ramsch has no discard.');
    }
  } else {
    const discardError = checkDiscard(setup, declarer);
    if (discardError !== null) {
      return discardError;
    }
  }
  const hands =
    declarer !== null && pickedUpSkat
      ? {
          ...setup.hands,
          [declarer]: [...setup.hands[declarer], ...setup.skat].filter((c) => !discarded.includes(c)),
        }
      : setup.hands;

  return ok({
    phase: 'playing',
    hands,
    initialHands: setup.hands,
    skat: setup.skat,
    bidding: { ...initialBidding(), stage: ramsch ? 'passed-in' : 'done', currentBid: bid },
    declarer,
    bid,
    pickedUpSkat,
    discarded,
    declaration: validDeclaration,
    doubling,
    doublePassed: [],
    trick: { leader: 'forehand', plays: [] },
    tricks: [],
    turn: 'forehand',
    result: null,
    options: { ramschOnPassIn: ramsch, kontra: doubling > 1 },
    ramsch,
  });
}
