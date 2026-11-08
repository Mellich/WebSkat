import { describe, expect, it } from 'vitest';
import type { ViewBidEvent } from '../../table';
import { translate } from '../i18n';
import { bubbleText, latestPerPlayer } from './bidBubbles';

const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate('en', key, params);
const bid = (playerId: string, value: number): ViewBidEvent => ({ playerId, type: 'bid', value });
const hold = (playerId: string): ViewBidEvent => ({ playerId, type: 'hold' });
const pass = (playerId: string): ViewBidEvent => ({ playerId, type: 'pass' });

describe('latestPerPlayer', () => {
  it('keeps only the latest new event of each player', () => {
    const history = [bid('a', 18), bid('b', 20), bid('a', 20)];
    const found = latestPerPlayer(history, 0);
    expect(Object.keys(found).sort()).toEqual(['a', 'b']);
    expect(found.a).toEqual({ event: bid('a', 20), index: 2 });
    expect(found.b).toEqual({ event: bid('b', 20), index: 1 });
  });

  it('skips the events before `from`', () => {
    const history = [bid('a', 18), hold('b'), bid('c', 20)];
    expect(latestPerPlayer(history, 2)).toEqual({ c: { event: bid('c', 20), index: 2 } });
    expect(latestPerPlayer(history, 3)).toEqual({});
  });
});

describe('bubbleText', () => {
  it('shows the bid value, or a word for the other events', () => {
    expect(bubbleText(bid('a', 20), t)).toBe('20');
    expect(bubbleText(hold('a'), t)).toBe('Yes');
    expect(bubbleText(pass('a'), t)).toBe('Pass');
    expect(bubbleText({ playerId: 'a', type: 'claim' }, t)).toBe('Play');
  });
});
