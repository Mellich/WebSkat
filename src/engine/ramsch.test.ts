import { describe, expect, it } from 'vitest';
import { sumPoints } from './cards';
import { applyAction, getLegal, newGame } from './game';
import { playModeOf, ramschScores } from './ramsch';
import { scoreGame } from './scoring';
import { apply, hand, PASS, run, stateWith } from './testing';
import type { GameState, Role } from './types';
import { DEFAULT_GAME_OPTIONS } from './types';

const RAMSCH = { ramschOnPassIn: true, kontra: false };

function perRole(forehand: number, middlehand: number, hindhand: number): Record<Role, number> {
  return { forehand, middlehand, hindhand };
}

describe('ramschScores (skat-rules §12.4, vectors §12.5)', () => {
  it.each([
    {
      name: 'R1 loser with the most points',
      points: perRole(50, 40, 30),
      tricks: perRole(4, 3, 3),
      losers: ['forehand'],
      jungfrau: false,
      durchmarsch: null,
      scores: perRole(-50, 0, 0),
    },
    {
      name: 'R2 Jungfrau doubles the loss',
      points: perRole(72, 48, 0),
      tricks: perRole(6, 4, 0),
      losers: ['forehand'],
      jungfrau: true,
      durchmarsch: null,
      scores: perRole(-144, 0, 0),
    },
    {
      name: 'R3 Durchmarsch wins 120',
      points: perRole(120, 0, 0),
      tricks: perRole(10, 0, 0),
      losers: [],
      jungfrau: false,
      durchmarsch: 'forehand',
      scores: perRole(120, 0, 0),
    },
    {
      name: 'R4 tie for the most points: both lose',
      points: perRole(45, 45, 30),
      tricks: perRole(4, 3, 3),
      losers: ['forehand', 'middlehand'],
      jungfrau: false,
      durchmarsch: null,
      scores: perRole(-45, -45, 0),
    },
    {
      name: 'R5 three-way tie: everybody loses',
      points: perRole(40, 40, 40),
      tricks: perRole(4, 3, 3),
      losers: ['forehand', 'middlehand', 'hindhand'],
      jungfrau: false,
      durchmarsch: null,
      scores: perRole(-40, -40, -40),
    },
  ])('$name', ({ points, tricks, losers, jungfrau, durchmarsch, scores }) => {
    const result = ramschScores(points, tricks);
    expect(result.losers).toEqual(losers);
    expect(result.jungfrau).toBe(jungfrau);
    expect(result.durchmarsch).toBe(durchmarsch);
    expect(result.scores).toEqual(scores);
  });
});

describe('Ramsch flow', () => {
  it('three passes with the option on start a Ramsch in the play phase', () => {
    const state = run(newGame(7, RAMSCH), [
      ['middlehand', PASS],
      ['hindhand', PASS],
      ['forehand', PASS],
    ]);
    expect(state.phase).toBe('playing');
    expect(state.ramsch).toBe(true);
    expect(state.turn).toBe('forehand');
    expect(state.declarer).toBeNull();
    expect(state.declaration).toBeNull();
    expect(state.result).toBeNull();
    expect(playModeOf(state)).toEqual({ kind: 'grand' });
  });

  it('the forehand may play any card when leading', () => {
    const state = run(newGame(7, RAMSCH), [
      ['middlehand', PASS],
      ['hindhand', PASS],
      ['forehand', PASS],
    ]);
    expect(getLegal(state, 'forehand').playableCards).toEqual(state.hands.forehand);
  });

  it('a Jack led must be followed by a Jack (Grand rule)', () => {
    const state = stateWith({
      phase: 'playing',
      ramsch: true,
      turn: 'forehand',
      hands: { forehand: hand('CJ'), middlehand: hand('SJ HA'), hindhand: hand('H7') },
    });
    const led = apply(state, 'forehand', { type: 'play', card: 'CJ' });
    expect(getLegal(led, 'middlehand').playableCards).toEqual(['SJ']);
    expect(applyAction(led, 'middlehand', { type: 'play', card: 'HA' }).ok).toBe(false);
  });

  it('with the option off, three passes still pass the game in', () => {
    const state = run(newGame(7, DEFAULT_GAME_OPTIONS), [
      ['middlehand', PASS],
      ['hindhand', PASS],
      ['forehand', PASS],
    ]);
    expect(state.phase).toBe('finished');
    expect(state.ramsch).toBe(false);
    expect(state.result).toEqual({ kind: 'passed-in' });
  });

  it('scoreGame of a state without Ramsch flag is unchanged (passed-in)', () => {
    expect(scoreGame(stateWith({ phase: 'finished' }))).toEqual({ kind: 'passed-in' });
  });
});

/** Plays a Ramsch to the end, always taking the first legal action. */
function playRamschFirstLegal(seed: number): GameState {
  let state = run(newGame(seed, RAMSCH), [
    ['middlehand', PASS],
    ['hindhand', PASS],
    ['forehand', PASS],
  ]);
  for (let step = 0; state.phase !== 'finished' && step < 100; step++) {
    const turn = state.turn;
    if (turn === null) break;
    const card = getLegal(state, turn).playableCards?.[0];
    if (card === undefined) break;
    state = apply(state, turn, { type: 'play', card });
  }
  return state;
}

describe('Ramsch result from a scripted game', () => {
  it('the last-trick winner gets the Skat points on top of the trick points (R6)', () => {
    const state = playRamschFirstLegal(7);
    const result = state.result;
    expect(result?.kind).toBe('ramsch');
    if (result?.kind !== 'ramsch') return;
    const last = state.tricks.at(-1);
    expect(last?.winner).toBe(result.skatTo);
    const trickPoints = sumPoints(
      state.tricks.filter((t) => t.winner === result.skatTo).flatMap((t) => t.plays.map((p) => p.card)),
    );
    expect(result.points[result.skatTo]).toBe(trickPoints + sumPoints(state.skat));
    expect(Object.values(result.points).reduce((a, b) => a + b, 0)).toBe(120);
  });
});
