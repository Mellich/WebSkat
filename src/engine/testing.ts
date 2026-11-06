import { isCardId } from './cards';
import type { CardId } from './types';

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
