import { ALL_CARDS } from './cards';
import { shuffle } from './rng';
import type { CardId, Role } from './types';

export interface Deal {
  readonly hands: Readonly<Record<Role, readonly CardId[]>>;
  readonly skat: readonly CardId[];
}

type IndexRange = readonly [from: number, to: number];

/** Deal order per docs/03-skat-rules.md §3: 3-3-3, Skat (2), 4-4-4, 3-3-3. */
export function deal(seed: number): Deal {
  const deck = shuffle(ALL_CARDS, seed);
  const pick = (ranges: readonly IndexRange[]): CardId[] =>
    ranges.flatMap(([from, to]) => deck.slice(from, to));
  return {
    hands: {
      forehand: pick([
        [0, 3],
        [11, 15],
        [23, 26],
      ]),
      middlehand: pick([
        [3, 6],
        [15, 19],
        [26, 29],
      ]),
      hindhand: pick([
        [6, 9],
        [19, 23],
        [29, 32],
      ]),
    },
    skat: deck.slice(9, 11),
  };
}
