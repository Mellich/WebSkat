import { describe, expect, it } from 'vitest';
import type { Declaration, GamePhase } from '../../engine';
import type { GameView } from '../../table';
import { translate } from '../i18n';
import { declarerSummary } from './declarerSummary';

const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate('en', key, params);
const nameOf = (id: string): string => (id === 'a' ? 'Anna' : 'Ben');
const GRAND: Declaration = { kind: 'grand', hand: false, announce: 'none', ouvert: false };
const GRAND_HAND: Declaration = { kind: 'grand', hand: true, announce: 'none', ouvert: false };

function game(phase: GamePhase, overrides: Partial<GameView> = {}): GameView {
  return { phase, declarerId: 'a', bid: 23, pickedUpSkat: false, declaration: null, ...overrides } as GameView;
}

describe('declarerSummary', () => {
  it('shows nothing while nobody has won the bidding', () => {
    expect(declarerSummary(game('bidding', { declarerId: null }), nameOf, t)).toBeNull();
    expect(declarerSummary(game('bidding'), nameOf, t)).toBeNull();
    expect(declarerSummary(game('finished', { declarerId: null }), nameOf, t)).toBeNull();
  });

  it('shows the winning bid while the Skat decision is open', () => {
    expect(declarerSummary(game('skat-decision'), nameOf, t)).toBe('Anna won the bidding at 23');
  });

  it('tells that the Skat was taken while discarding', () => {
    expect(declarerSummary(game('discarding', { pickedUpSkat: true }), nameOf, t))
      .toBe('Anna won the bidding at 23 · took the Skat');
  });

  it('tells whether the declarer took the Skat or plays Hand while declaring', () => {
    expect(declarerSummary(game('declaring', { pickedUpSkat: true }), nameOf, t))
      .toBe('Anna won the bidding at 23 · took the Skat');
    expect(declarerSummary(game('declaring', { pickedUpSkat: false }), nameOf, t))
      .toBe('Anna won the bidding at 23 · plays Hand');
  });

  it('names the game while playing, with the Skat or without it', () => {
    expect(declarerSummary(game('playing', { pickedUpSkat: true, declaration: GRAND }), nameOf, t))
      .toBe('Grand by Anna (bid 23) · took the Skat');
    expect(declarerSummary(game('playing', { declaration: GRAND_HAND }), nameOf, t))
      .toBe('Grand Hand by Anna (bid 23)');
  });

  it('names the game already in the Kontra and Re window, so the doubling refers to it', () => {
    expect(declarerSummary(game('doubling', { declaration: GRAND_HAND }), nameOf, t))
      .toBe('Grand Hand by Anna (bid 23)');
    expect(declarerSummary(game('doubling', { pickedUpSkat: true, declaration: GRAND }), nameOf, t))
      .toBe('Grand by Anna (bid 23) · took the Skat');
  });

  it('adds Kontra to the game name once it is said during the doubling window', () => {
    expect(declarerSummary(game('doubling', { doubling: 2, declaration: GRAND }), nameOf, t))
      .toBe('Grand by Anna (bid 23) · Kontra');
  });

  it('keeps the game name when the round is finished', () => {
    expect(declarerSummary(game('finished', { pickedUpSkat: true, declaration: GRAND }), nameOf, t))
      .toBe('Grand by Anna (bid 23) · took the Skat');
  });

  it('shows nothing for a finished round that was passed in', () => {
    expect(declarerSummary(game('finished', { declarerId: null }), nameOf, t)).toBeNull();
  });
});

describe('declarerSummary in Ramsch', () => {
  it('says that everybody plays alone, without a declarer', () => {
    expect(declarerSummary(game('playing', { ramsch: true, declarerId: null, bid: null }), nameOf, t))
      .toBe('Ramsch: everybody plays alone; fewest points win');
  });
});
