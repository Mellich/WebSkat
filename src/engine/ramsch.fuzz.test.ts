import { describe, expect, it } from 'vitest';
import { sumPoints } from './cards';
import { applyAction, enumerateActions, isFinished, newGame } from './game';
import { ramschScores } from './ramsch';
import { mulberry32 } from './rng';
import { ROLES, type GameAction, type GameState, type Role } from './types';

/** Property test for Ramsch (skat-rules §12): random legal games with the table rule on. */

const GAMES = 500;
const MAX_STEPS = 200;

function check(condition: boolean, label: string, message: string): asserts condition {
  if (!condition) {
    throw new Error(`${label}: ${message}`);
  }
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error('cannot pick from an empty list');
  }
  return item;
}

/** Mostly passes, so that most seeds reach a Ramsch; otherwise any legal action. */
function choose(actions: readonly GameAction[], random: () => number): GameAction {
  const pass = actions.find((a) => a.type === 'pass');
  if (pass !== undefined && random() < 0.7) {
    return pass;
  }
  return pick(actions, random);
}

function playOne(seed: number): { ramsch: boolean } {
  const label = `seed ${String(seed)}`;
  const random = mulberry32(seed * 104729 + 3);
  let state: GameState = newGame(seed, { ramschOnPassIn: true, kontra: false });
  for (let step = 0; !isFinished(state); step++) {
    check(step < MAX_STEPS, label, 'game did not finish');
    const turn = state.turn;
    check(turn !== null, label, 'no one is on turn');
    const actions = enumerateActions(state, turn);
    check(actions.length > 0, label, 'the player on turn has no actions');
    const next = applyAction(state, turn, choose(actions, random));
    check(next.ok, label, 'chosen action rejected');
    state = next.value;
  }

  const result = state.result;
  check(result !== null, label, 'finished without a result');
  if (result.kind !== 'ramsch') {
    return { ramsch: false };
  }
  check(state.ramsch, label, 'a Ramsch result needs the ramsch flag');
  check(ROLES.every((role: Role) => state.hands[role].length === 0), label, 'all cards must be played');
  check(state.tricks.length === 10, label, 'a Ramsch plays all 10 tricks');
  const total = ROLES.reduce((sum, role) => sum + result.points[role], 0);
  check(total === 120, label, 'card points must add up to 120');
  const trickTotal = ROLES.reduce((sum, role) => sum + result.tricks[role], 0);
  check(trickTotal === 10, label, 'tricks must add up to 10');
  const skatTo = state.tricks.at(-1)?.winner;
  check(skatTo === result.skatTo, label, 'the Skat goes to the last trick winner');
  for (const role of ROLES) {
    const cards = state.tricks.filter((t) => t.winner === role).flatMap((t) => t.plays.map((p) => p.card));
    const expected = sumPoints(cards) + (role === skatTo ? sumPoints(state.skat) : 0);
    check(result.points[role] === expected, label, `${role} card points`);
  }
  const recomputed = ramschScores(result.points, result.tricks);
  check(JSON.stringify(recomputed.scores) === JSON.stringify(result.scores), label, 'scores do not match §12.4');
  check(JSON.stringify(recomputed.losers) === JSON.stringify(result.losers), label, 'losers do not match');
  return { ramsch: true };
}

describe('Ramsch games (fuzz)', () => {
  it(`plays ${String(GAMES)} seeded games with the Ramsch rule to the end`, () => {
    let ramschGames = 0;
    for (let seed = 1; seed <= GAMES; seed++) {
      if (playOne(seed).ramsch) {
        ramschGames++;
      }
    }
    expect(ramschGames).toBeGreaterThan(0);
  }, 120_000);
});
