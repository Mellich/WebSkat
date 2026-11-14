// Data of the game analysis (docs/table.md, "Game analysis"). JSON-serializable; card ids come only from a finished game.

import type {
  CardId,
  CompletedTrick,
  Declaration,
  DoubleLevel,
  GameResult,
  GameState,
  Role,
  Trick,
} from '../../engine';

export type AnalysisKind = 'played' | 'ramsch' | 'passed-in';

export interface AnalysisBid {
  readonly role: Role;
  readonly type: 'bid' | 'hold' | 'pass' | 'claim';
  readonly value?: number | undefined;
}

/** Everything the analysis needs about one finished game. Travels in the URL (step 05). */
export interface AnalysisInput {
  readonly version: 1;
  readonly kind: AnalysisKind;
  readonly names: Readonly<Record<Role, string>>;
  readonly hands: Readonly<Record<Role, readonly CardId[]>>; // as dealt
  readonly skat: readonly CardId[]; // as dealt
  readonly declarer: Role | null; // null for Ramsch and passed-in games
  readonly declaration: Declaration | null;
  readonly bid: number | null;
  readonly pickedUpSkat: boolean;
  readonly discarded: readonly CardId[];
  readonly doubling: DoubleLevel;
  readonly bidding: readonly AnalysisBid[];
  readonly plays: readonly CardId[]; // the actual card play in order (who plays follows from the rules)
}

/** A line of play: the cards in order and how many of them are applied. */
export interface AnalysisLine {
  readonly plays: readonly CardId[];
  readonly cursor: number; // 0 = before the first card; plays.length = end of the line
}

/** The game after the cards of a line up to its cursor, prepared for display and for the sampler. */
export interface Position {
  readonly state: GameState; // for scoreBatch (step 04); the UI does not read it
  readonly hands: Readonly<Record<Role, readonly CardId[]>>; // cards still in hand
  readonly trick: Trick; // current trick (may be empty)
  readonly lastTrick: CompletedTrick | null;
  readonly tricks: readonly CompletedTrick[];
  readonly tricksWon: Readonly<Record<Role, number>>;
  readonly points: Readonly<Record<Role, number>>; // card points won in tricks so far
  readonly mover: Role | null; // who plays next; null when the game is over
  readonly playable: readonly CardId[]; // legal cards of the mover ([] when over)
  readonly result: GameResult | null; // set when the line reached the end of the game
}
