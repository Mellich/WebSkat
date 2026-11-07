import { describe, expect, it } from 'vitest';
import { ALL_CARDS, mulberry32, suitOf, type Declaration, type Role } from '../../engine';
import { hand, stateWith } from '../../engine/testing';
import { botViewOf, type BotView } from './knowledge';
import { sampleDeal } from './sample';

const hearts: Declaration = { kind: 'suit', trump: 'H', hand: false, announce: 'none', ouvert: false };

/** Defender view after one trick in which the declarer (forehand) showed a void in clubs. */
function defenderView(): BotView {
  const state = stateWith({
    phase: 'playing',
    declaration: hearts,
    declarer: 'forehand',
    pickedUpSkat: true,
    bid: 18,
    hands: {
      forehand: hand('CJ SJ HA H10 HK H9 H8 SA S7'),
      middlehand: hand('C10 CK C9 C8 S10 SK D10 DK DQ'),
      hindhand: hand('CQ C7 DJ HJ SQ S9 D9 D8 D7'),
    },
    skat: hand('S8 DA'),
    discarded: hand('S8 DA'),
    tricks: [
      {
        leader: 'middlehand',
        plays: [{ role: 'middlehand', card: 'CA' }, { role: 'hindhand', card: 'HQ' }, { role: 'forehand', card: 'H7' }],
        winner: 'forehand',
      },
    ],
    trick: { leader: 'forehand', plays: [] },
    turn: 'middlehand',
  });
  return botViewOf(state, 'middlehand');
}

describe('sampleDeal', () => {
  it('respects hand sizes, voids and known cards', () => {
    const view = defenderView();
    const rand = mulberry32(5);
    for (let i = 0; i < 50; i++) {
      const sample = sampleDeal(view, rand);
      const others: Role[] = ['forehand', 'hindhand'];
      for (const r of others) expect(sample.hands[r]).toHaveLength(view.handCounts[r]);
      expect(sample.skat).toHaveLength(2);
      expect(sample.hands.middlehand).toEqual(view.hand);
      expect(sample.hands.forehand.some((c) => suitOf(c) === 'C' && !c.endsWith('J'))).toBe(false);
      const all = [...sample.hands.forehand, ...sample.hands.middlehand, ...sample.hands.hindhand, ...sample.skat, 'CA', 'HQ', 'H7'];
      expect([...new Set(all)].sort()).toEqual([...ALL_CARDS].sort());
    }
  });

  it('is deterministic for a seed', () => {
    const view = defenderView();
    expect(sampleDeal(view, mulberry32(9))).toEqual(sampleDeal(view, mulberry32(9)));
  });

  it('keeps the known discard as the Skat for the declarer', () => {
    const view = defenderView();
    const declarerView = { ...view, role: 'forehand' as const, hand: hand('CJ SJ HA H10 HK H9 H8 SA S7'), ownDiscard: hand('S8 DA') };
    expect(sampleDeal(declarerView, mulberry32(1)).skat).toEqual(['S8', 'DA']);
  });
});
