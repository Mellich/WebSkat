import { card } from './cards';
import type { PlayMode } from './trump';
import type { CardId, Rank } from './types';

const JACKS: readonly CardId[] = ['CJ', 'SJ', 'HJ', 'DJ'];
const TRUMP_SUIT_RANKS: readonly Rank[] = ['A', '10', 'K', 'Q', '9', '8', '7'];

/**
 * Counts Spitzen from the declarer's 12 cards (docs/03 §7).
 * "mit n" when CJ is held (n consecutive top trumps held), otherwise "ohne n"
 * (n consecutive top trumps not held). Returns null for Null.
 */
export function countSpitzen(
  twelve: readonly CardId[],
  mode: PlayMode,
): { readonly with: boolean; readonly count: number } | null {
  if (mode.kind === 'null') return null;
  const sequence: readonly CardId[] =
    mode.kind === 'grand'
      ? JACKS
      : [...JACKS, ...TRUMP_SUIT_RANKS.map((rank) => card(mode.trump, rank))];
  const withJack = twelve.includes('CJ');
  let count = 0;
  for (const c of sequence) {
    if (twelve.includes(c) !== withJack) break;
    count++;
  }
  return { with: withJack, count };
}
