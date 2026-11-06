import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from './cards';
import { applyAction, enumerateActions, getLegal, isFinished, newGame } from './game';
import { mulberry32 } from './rng';
import { ROLES, type CardId, type GameAction, type GameResult, type GameState } from './types';

/** Property test (docs/09-testing.md §2): random legal games played to the end. */

const GAMES = 2000;
const MAX_STEPS = 300;

/** `label` identifies the game (seed) in failure messages. */
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

/** Every card is in exactly one place: a hand, the table, a trick, the discards or the Skat. */
function checkCardConservation(state: GameState, label: string): void {
  const cards: CardId[] = [
    ...ROLES.flatMap((role) => state.hands[role]),
    ...state.trick.plays.map((p) => p.card),
    ...state.tricks.flatMap((t) => t.plays.map((p) => p.card)),
    ...state.discarded,
    ...(state.pickedUpSkat ? [] : state.skat),
  ];
  check(
    JSON.stringify([...cards].sort()) === JSON.stringify([...ALL_CARDS].sort()),
    label,
    'cards are not conserved',
  );
}

function checkResult(state: GameState, result: GameResult & { kind: 'played' }, label: string): void {
  check(state.declarer === result.declarer, label, 'declarer mismatch');
  check(
    state.tricks.length === result.declarerTricks + result.defenderTricks,
    label,
    'trick counts do not add up',
  );
  check(result.won === (result.playedWon && !result.overbid), label, 'won must be playedWon and not overbid');
  if (result.won) {
    check(result.declarerScore === result.gameValue, label, 'a won game scores the game value');
  } else {
    const lostValue = result.loseValue;
    check(lostValue !== null, label, 'a lost game needs a loss value');
    check(result.declarerScore === -2 * lostValue, label, 'a lost game scores -2 × loss value');
  }

  for (let i = 1; i < state.tricks.length; i++) {
    const previous = state.tricks[i - 1];
    const current = state.tricks[i];
    check(previous !== undefined && current !== undefined, label, 'missing trick');
    check(current.leader === previous.winner, label, 'the trick winner must lead the next trick');
  }

  if (result.declaration.kind === 'null') {
    check(result.declarerPoints === 0 && result.defenderPoints === 0, label, 'Null has no points');
    if (result.declarerTricks > 0) {
      check(result.declarerTricks === 1, label, 'a Null ends at the declarer\'s first trick');
      check(state.tricks.at(-1)?.winner === result.declarer, label, 'the declarer\'s trick must be the last');
    }
    return;
  }

  check(state.tricks.length === 10, label, 'suit and grand games play all 10 tricks');
  check(result.declarerPoints + result.defenderPoints === 120, label, 'card points must add up to 120');
  check(
    result.schwarz === (result.declarerTricks === 10 || result.declarerTricks === 0),
    label,
    'schwarz flag',
  );
  check(ROLES.every((role) => state.hands[role].length === 0), label, 'all cards must be played');
}

interface Tally {
  passedIn: number;
  played: number;
  wins: number;
  losses: number;
  kinds: Record<'suit' | 'grand' | 'null', number>;
}

function playOneGame(seed: number, tally: Tally): void {
  const label = `seed ${String(seed)}`;
  const random = mulberry32(seed * 7919 + 17);
  let state = newGame(seed);
  for (let step = 0; !isFinished(state); step++) {
    check(step < MAX_STEPS, label, 'game did not finish');
    const turn = state.turn;
    check(turn !== null, label, 'no one is on turn');

    for (const role of ROLES) {
      if (role !== turn) {
        check(enumerateActions(state, role).length === 0, label, 'actions offered to a role not on turn');
      }
    }
    const actions = enumerateActions(state, turn);
    check(actions.length > 0, label, 'the player on turn has no actions');
    for (const action of actions) {
      check(applyAction(state, turn, action).ok, label, `enumerated ${action.type} was rejected`);
    }

    const before = JSON.stringify(state);

    const intruder = pick(
      ROLES.filter((r) => r !== turn),
      random,
    );
    const intruderAction: GameAction = pick(actions, random);
    check(!applyAction(state, intruder, intruderAction).ok, label, 'out-of-turn action accepted');
    check(JSON.stringify(state) === before, label, 'rejected action changed the state');

    if (state.phase === 'playing') {
      const legal = getLegal(state, turn).playableCards ?? [];
      const illegal = ALL_CARDS.filter((c) => !legal.includes(c));
      if (illegal.length > 0) {
        const card = pick(illegal, random);
        check(!applyAction(state, turn, { type: 'play', card }).ok, label, 'illegal card accepted');
        check(JSON.stringify(state) === before, label, 'rejected card changed the state');
      }
    }

    const next = applyAction(state, turn, pick(actions, random));
    check(next.ok, label, 'chosen action rejected');
    state = next.value;
    checkCardConservation(state, label);
  }

  const result = state.result;
  check(result !== null, label, 'finished without a result');
  if (result.kind === 'passed-in') {
    check(state.tricks.length === 0 && state.declarer === null, label, 'passed-in game with play');
    tally.passedIn++;
    return;
  }
  checkResult(state, result, label);
  tally.played++;
  tally.kinds[result.declaration.kind]++;
  if (result.won) {
    tally.wins++;
  } else {
    tally.losses++;
  }
}

describe('random legal games (fuzz)', () => {
  it(`plays ${String(2000)} seeded games to the end with all invariants holding`, () => {
    const tally: Tally = {
      passedIn: 0,
      played: 0,
      wins: 0,
      losses: 0,
      kinds: { suit: 0, grand: 0, null: 0 },
    };
    for (let seed = 1; seed <= GAMES; seed++) {
      playOneGame(seed, tally);
    }
    expect(tally.passedIn + tally.played).toBe(GAMES);
    expect(tally.played).toBeGreaterThan(0);
    expect(tally.wins).toBeGreaterThan(0);
    expect(tally.losses).toBeGreaterThan(0);
    expect(tally.kinds.suit).toBeGreaterThan(0);
    expect(tally.kinds.grand).toBeGreaterThan(0);
    expect(tally.kinds.null).toBeGreaterThan(0);
  }, 120_000);
});
