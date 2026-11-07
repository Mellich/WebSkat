import { describe, expect, it } from 'vitest';
import { deal, rankOf, type BiddingState, type Legal } from '../../engine';
import { hand, stateWith } from '../../engine/testing';
import { auctionAction, chooseDiscard, chooseGame, floorValue, skatDecision } from './auction';
import { botViewOf, type BotView } from './knowledge';

function auctionView(legal: Legal, currentBid: number | null): BotView {
  const base = botViewOf(stateWith({}), 'middlehand');
  const bidding: BiddingState = { ...base.bidding, currentBid };
  return { ...base, legal, bidding };
}

describe('auctionAction', () => {
  it('bids the next value only while it is within the limit', () => {
    expect(auctionAction(auctionView({ bidValues: [20], canPassBid: true }, 18), 20)).toEqual({ type: 'bid', value: 20 });
    expect(auctionAction(auctionView({ bidValues: [20], canPassBid: true }, 18), 18)).toEqual({ type: 'pass' });
  });

  it('holds up to the limit', () => {
    expect(auctionAction(auctionView({ canHold: true, canPassBid: true }, 24), 24)).toEqual({ type: 'hold' });
    expect(auctionAction(auctionView({ canHold: true, canPassBid: true }, 24), 23)).toEqual({ type: 'pass' });
  });

  it('claims only with a playable game', () => {
    expect(auctionAction(auctionView({ canClaim: true, canPassBid: true }, null), 18)).toEqual({ type: 'claim' });
    expect(auctionAction(auctionView({ canClaim: true, canPassBid: true }, null), 0)).toEqual({ type: 'pass' });
  });
});

describe('Skat decision, discard and declaration', () => {
  it('plays Hand with a very strong hand and picks up otherwise', () => {
    const strong = hand('CJ SJ HJ DJ CA C10 SA S10 HA D7');
    const weak = hand('CJ HA H10 HK H8 H7 CA D7 S8 S9');
    const view = (cards: typeof strong): BotView => ({
      ...botViewOf(stateWith({ phase: 'skat-decision', declarer: 'forehand', bid: 18, turn: 'forehand' }), 'forehand'),
      hand: cards,
    });
    expect(skatDecision(view(strong))).toEqual({ type: 'play-hand' });
    expect(skatDecision(view(weak))).toEqual({ type: 'pickup-skat' });
  });

  it('never discards a Jack for a suit or Grand game', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const { hands, skat } = deal(seed);
      const twelve = [...hands.forehand, ...skat];
      const choice = chooseDiscard(twelve, 18);
      if (choice.game.game !== 'null') expect(choice.cards.some((c) => rankOf(c) === 'J')).toBe(false);
    }
  }, 60_000);

  it('puts a lone ten away rather than a trump', () => {
    const twelve = hand('CJ SJ HA H10 HK H9 H8 H7 CA C7 S10 D8');
    const choice = chooseDiscard(twelve, 18);
    expect(choice.game.game).toBe('H');
    expect(choice.cards).toContain('S10');
  });

  it('declares a game that reaches the bid when one exists', () => {
    const cards = hand('CJ SJ HA H10 HK H9 H8 CA C7 S9');
    const state = stateWith({
      phase: 'declaring',
      declarer: 'forehand',
      bid: 30,
      pickedUpSkat: true,
      discarded: hand('D7 D8'),
      hands: { forehand: cards, middlehand: [], hindhand: [] },
      turn: 'forehand',
    });
    const decl = chooseGame(botViewOf(state, 'forehand'));
    expect(decl).toMatchObject({ kind: 'suit', trump: 'H', hand: false });
    expect(floorValue(decl, [...cards, 'D7', 'D8'])).toBeGreaterThanOrEqual(30);
  });
});
