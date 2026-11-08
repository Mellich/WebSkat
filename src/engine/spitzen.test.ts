import { describe, expect, it } from 'vitest';
import { countSpitzen } from './spitzen';
import { hand } from './testing';
import type { PlayMode } from './trump';

const HEARTS: PlayMode = { kind: 'suit', trump: 'H' };
const CLUBS: PlayMode = { kind: 'suit', trump: 'C' };
const GRAND: PlayMode = { kind: 'grand' };

describe('countSpitzen (skat-rules §7 examples)', () => {
  it.each([
    ['holds CJ SJ DJ, not HJ → mit 2', HEARTS, 'CJ SJ DJ', { with: true, count: 2 }],
    ['holds HJ DJ only → ohne 2', HEARTS, 'HJ DJ', { with: false, count: 2 }],
    ['Hearts: CJ SJ HJ DJ HA H10 H9 → mit 6', HEARTS, 'CJ SJ HJ DJ HA H10 H9', { with: true, count: 6 }],
    ['Hearts: DJ HA, no CJ SJ HJ → ohne 3', HEARTS, 'DJ HA', { with: false, count: 3 }],
    ['Clubs: all 11 trumps → mit 11', CLUBS, 'CJ SJ HJ DJ CA C10 CK CQ C9 C8 C7', { with: true, count: 11 }],
    ['Grand: all four Jacks → mit 4', GRAND, 'CJ SJ HJ DJ', { with: true, count: 4 }],
    ['Grand: CJ only → mit 1', GRAND, 'CJ', { with: true, count: 1 }],
    ['Grand: no Jacks → ohne 4', GRAND, 'CA CK', { with: false, count: 4 }],
    ['Hearts: no Jacks and no trump, ohne 11', HEARTS, 'CA SK', { with: false, count: 11 }],
    ['Hearts: CJ only → mit 1', HEARTS, 'CJ', { with: true, count: 1 }],
  ] as const)('%s', (_name, mode, cards, expected) => {
    expect(countSpitzen(hand(cards), mode)).toEqual(expected);
  });

  it('counts only trumps of the trump suit after the Jacks', () => {
    // Holds CJ and SJ, then HA but not HJ: the sequence stops at the missing HJ.
    expect(countSpitzen(hand('CJ SJ HA DA'), HEARTS)).toEqual({ with: true, count: 2 });
  });

  it('returns null for Null', () => {
    expect(countSpitzen(hand('CJ SJ HJ DJ'), { kind: 'null' })).toBeNull();
  });
});
