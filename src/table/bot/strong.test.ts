import { describe, expect, it } from 'vitest';
import { applyAction, mulberry32, newGame, type GameState } from '../../engine';
import { envFlag, nowMs, playGame } from './arena';
import { botAction } from './index';
import { botViewOf } from './knowledge';
import { sampleCount, strongCard, strongMaxBid } from './strong';

/** States in the play phase of a normal-bot game. */
function playStates(seed: number): GameState[] {
  const rand = mulberry32(seed);
  const states: GameState[] = [];
  let state = newGame(seed);
  while (state.phase !== 'finished' && state.turn !== null) {
    if (state.phase === 'playing') states.push(state);
    const result = applyAction(state, state.turn, botAction(state, state.turn, 'normal', rand));
    if (!result.ok) throw new Error(result.error.message);
    state = result.value;
  }
  return states;
}

describe('strong card play', () => {
  it('returns a playable card, deterministically for a seed', () => {
    for (const state of playStates(3).slice(0, 12)) {
      const view = botViewOf(state, state.turn ?? 'forehand');
      const card = strongCard(view, mulberry32(4));
      expect(view.playable).toContain(card);
      expect(strongCard(view, mulberry32(4))).toBe(card);
    }
  }, 60_000);

  it('plays the only legal card without sampling', () => {
    const state = playStates(3).find((s) => botViewOf(s, s.turn ?? 'forehand').playable.length === 1);
    if (state === undefined) throw new Error('test data: no forced play found');
    const view = botViewOf(state, state.turn ?? 'forehand');
    const rand = (): number => {
      throw new Error('must not sample');
    };
    expect(strongCard(view, rand)).toBe(view.playable[0]);
  });

  it('spends fewer samples per card when many cards are playable', () => {
    expect(sampleCount(2)).toBe(40);
    expect(sampleCount(10)).toBe(12);
  });

  it('gives a stable auction limit for a hand', () => {
    const view = botViewOf(newGame(11), 'middlehand');
    expect(strongMaxBid(view)).toBe(strongMaxBid({ ...view, hand: [...view.hand].reverse() }));
  });

  // Wall-clock checks only make sense on an idle machine: run them with BOT_BENCH=1.
  it.skipIf(!envFlag('BOT_BENCH'))('decides a card in under 100 ms (median)', () => {
    const times: number[] = [];
    for (const state of playStates(8).slice(0, 20)) {
      const view = botViewOf(state, state.turn ?? 'forehand');
      const start = nowMs();
      strongCard(view, mulberry32(1));
      times.push(nowMs() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(100);
  }, 60_000);

  it.skipIf(!envFlag('BOT_BENCH'))('plays a full game with three strong bots in under 5 s', () => {
    const start = nowMs();
    const game = playGame(21, { forehand: 'strong', middlehand: 'strong', hindhand: 'strong' });
    expect(game.state.phase).toBe('finished');
    expect(nowMs() - start).toBeLessThan(5000);
  }, 10_000);
});
