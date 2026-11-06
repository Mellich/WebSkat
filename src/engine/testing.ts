import { ALL_CARDS, isCardId } from './cards';
import { applyAction, newGame } from './game';
import type { CardId, GameAction, GameState, Role } from './types';

/** Test helper: parses a space-separated card list such as 'CJ SJ HA S10'. Not exported from index. */
export function hand(text: string): CardId[] {
  return text
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map((s) => {
      if (!isCardId(s)) {
        throw new Error(`Invalid card id in test data: ${s}`);
      }
      return s;
    });
}

/** Test helper: the card at `index`; throws when the list is too short (test data error). */
export function cardAt(cards: readonly CardId[], index: number): CardId {
  const c = cards[index];
  if (c === undefined) {
    throw new Error(`No card at index ${String(index)} in test data`);
  }
  return c;
}

/** Test helper: deep copy of a JSON-serializable value (engine states are JSON by design). */
export function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Test helper: a fresh game (seed 1) with the given fields overridden. */
export function stateWith(overrides: Partial<GameState>): GameState {
  return { ...newGame(1), ...overrides };
}

export type Step = readonly [Role, GameAction];

/** Applies an action that must be accepted; throws otherwise (test data error). */
export function apply(state: GameState, role: Role, action: GameAction): GameState {
  const result = applyAction(state, role, action);
  if (!result.ok) {
    throw new Error(`${role} ${action.type} rejected: ${result.error.code} ${result.error.message}`);
  }
  return result.value;
}

export function run(start: GameState, steps: readonly Step[]): GameState {
  return steps.reduce((state, [role, action]) => apply(state, role, action), start);
}

/** A card that `role` does not hold. */
export function absentCard(state: GameState, role: Role): CardId {
  const card = ALL_CARDS.find((c) => !state.hands[role].includes(c));
  if (card === undefined) {
    throw new Error('every card is in the hand');
  }
  return card;
}

export const bid = (value: number): GameAction => ({ type: 'bid', value });
export const PASS: GameAction = { type: 'pass' };
export const HOLD: GameAction = { type: 'hold' };
export const PICKUP: GameAction = { type: 'pickup-skat' };
export const PLAY_HAND: GameAction = { type: 'play-hand' };
export const DECLARE_HEARTS: GameAction = {
  type: 'declare',
  declaration: { kind: 'suit', trump: 'H', hand: false, announce: 'none', ouvert: false },
};

/** Middlehand bids 18, both others pass: the middlehand is the declarer (skat-decision phase). */
export function afterBidding(): GameState {
  return run(newGame(1), [
    ['middlehand', bid(18)],
    ['forehand', PASS],
    ['hindhand', PASS],
  ]);
}

/** Declarer has picked up the Skat (discarding phase). */
export function afterPickup(): GameState {
  return apply(afterBidding(), 'middlehand', PICKUP);
}

/** Declarer has discarded the first two cards of the hand (declaring phase). */
export function afterDiscard(): GameState {
  const state = afterPickup();
  const [a, b] = state.hands.middlehand;
  if (a === undefined || b === undefined) {
    throw new Error('expected 12 cards in hand');
  }
  return apply(state, 'middlehand', { type: 'discard', cards: [a, b] });
}

/** Hearts declared with the Skat picked up (playing phase, forehand to lead). */
export function playingState(): GameState {
  return apply(afterDiscard(), 'middlehand', DECLARE_HEARTS);
}
