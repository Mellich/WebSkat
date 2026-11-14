import { describe, expect, it } from 'vitest';
import { ALL_CARDS, type CardId } from '../../engine';
import type { CardStat } from '../../table';
import { percent, points, rankStats } from './scoreFormat';

function cardAt(index: number): CardId {
  const card = ALL_CARDS[index];
  if (card === undefined) throw new Error(`no card ${String(index)}`);
  return card;
}

const first = cardAt(0);
const second = cardAt(1);
const third = cardAt(2);
const unsampled = cardAt(3);

function stat(card: CardId, samples: number, wins: number, pointSum: number): CardStat {
  return { card, samples, wins, points: pointSum, histogram: [], worlds: [] };
}

describe('percent', () => {
  it('rounds the win rate to a whole percent', () => {
    expect(percent(0.823)).toBe('82 %');
    expect(percent(0.5)).toBe('50 %');
  });

  it('shows a dash before the first sample', () => {
    expect(percent(null)).toBe('–');
  });
});

describe('points', () => {
  it('rounds the average card points', () => {
    expect(points(74.4)).toBe('74');
    expect(points(74.6)).toBe('75');
  });

  it('shows a dash before the first sample', () => {
    expect(points(null)).toBe('–');
  });
});

describe('rankStats', () => {
  it('sorts by win rate, then average points; unsampled cards last', () => {
    const ranked = rankStats([
      stat(unsampled, 0, 0, 0),
      stat(second, 10, 6, 500), // 60 %, 50 points
      stat(first, 10, 6, 600), // 60 %, 60 points
      stat(third, 10, 9, 100), // 90 %
    ]);
    expect(ranked.map((s) => s.card)).toEqual([third, first, second, unsampled]);
  });

  it('breaks ties in points by the order of the cards', () => {
    const ranked = rankStats([stat(second, 10, 5, 400), stat(first, 10, 5, 400)]);
    expect(ranked.map((s) => s.card)).toEqual([first, second]);
  });

  it('ranks by the chosen criterion first', () => {
    const lowWinHighMax: CardStat = { ...stat(second, 2, 1, 100), histogram: [...new Array<number>(50).fill(0), 1, ...new Array<number>(69).fill(0), 1] };
    const highWinLowMax: CardStat = { ...stat(first, 2, 2, 60), histogram: [...new Array<number>(30).fill(0), 2, ...new Array<number>(90).fill(0)] };
    expect(rankStats([lowWinHighMax, highWinLowMax], 'win').map((s) => s.card)).toEqual([first, second]);
    expect(rankStats([highWinLowMax, lowWinHighMax], 'max').map((s) => s.card)).toEqual([second, first]);
  });

  it('does not change its input', () => {
    const input = [stat(second, 10, 1, 1), stat(first, 10, 9, 1)];
    rankStats(input);
    expect(input.map((s) => s.card)).toEqual([second, first]);
  });
});
