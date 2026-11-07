// Legality at every level and the strength check (docs/14-bots.md §8, items 7–8).

import { describe, expect, it } from 'vitest';
import { applyAction, mulberry32, newGame, nextBidValue, type GameState } from '../../engine';
import type { BotLevel } from '../types';
import { envFlag, match } from './arena';
import { chooseBotAction, isLegalChoice } from './index';
import { botViewOf } from './knowledge';

/** Plays one game where every choice must already be legal (no fallback). */
function playStrictly(seed: number, level: BotLevel): GameState {
  const rand = mulberry32(seed);
  let state = newGame(seed);
  while (state.phase !== 'finished' && state.turn !== null) {
    const view = botViewOf(state, state.turn);
    const action = chooseBotAction(view, level, rand);
    expect(isLegalChoice(view, action), `${level} seed ${String(seed)}: ${JSON.stringify(action)}`).toBe(true);
    if (action.type === 'bid' && level !== 'easy') expect(action.value).toBe(nextBidValue(state.bidding.currentBid));
    const result = applyAction(state, state.turn, action);
    if (!result.ok) throw new Error(result.error.message);
    state = result.value;
  }
  return state;
}

describe.each([
  ['easy', 300],
  ['normal', 300],
  ['strong', 6],
] as const)('%s bots', (level, games) => {
  it(`choose only legal actions in ${String(games)} games`, () => {
    for (let seed = 1; seed <= games; seed++) expect(playStrictly(seed * 31, level).phase).toBe('finished');
  }, 120_000);
});

describe('bot strength', () => {
  it('normal beats easy', () => {
    const result = match('normal', 'easy', 200);
    expect(result.soloAverage).toBeGreaterThan(result.restAverage);
    expect(result.soloDeclarerWon / result.soloDeclarerGames).toBeGreaterThanOrEqual(0.55);
  }, 120_000);

  it.skipIf(!envFlag('BOT_BENCH'))('strong is at least as good as normal', () => {
    const result = match('strong', 'normal', 40);
    expect(result.soloAverage, JSON.stringify(result)).toBeGreaterThanOrEqual(result.restAverage);
  }, 1_800_000);
});
