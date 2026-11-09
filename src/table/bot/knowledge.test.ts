import { describe, expect, it } from 'vitest';
import { applyAction, mulberry32, newGame, ROLES, type CardId, type GameState, type Role } from '../../engine';
import { hand, stateWith } from '../../engine/testing';
import { botAction, chooseBotAction } from './index';
import { botViewOf, voidsOf } from './knowledge';

type Holder = { kind: 'hand'; role: Role } | { kind: 'skat' } | { kind: 'discarded' };

/** Places whose cards `role` cannot see. */
function hiddenHolders(game: GameState, role: Role): Holder[] {
  const holders: Holder[] = [];
  const openDeclarer = game.phase === 'playing' && game.declaration?.ouvert === true ? game.declarer : null;
  for (const r of ROLES) {
    if (r !== role && r !== openDeclarer && game.hands[r].length > 0) holders.push({ kind: 'hand', role: r });
  }
  const knowsSkat = game.declarer === role && game.pickedUpSkat;
  if (!knowsSkat) holders.push({ kind: 'skat' });
  if (!knowsSkat && game.discarded.length > 0) holders.push({ kind: 'discarded' });
  return holders;
}

function cardsOf(game: GameState, h: Holder): readonly CardId[] {
  if (h.kind === 'hand') return game.hands[h.role];
  return h.kind === 'skat' ? game.skat : game.discarded;
}

function withCards(game: GameState, h: Holder, cards: CardId[]): GameState {
  if (h.kind === 'hand') return { ...game, hands: { ...game.hands, [h.role]: cards } };
  return h.kind === 'skat' ? { ...game, skat: cards } : { ...game, discarded: cards };
}

/** Swaps one hidden card between two hidden places; null if there are not two places. */
function swapHidden(game: GameState, role: Role, rand: () => number): GameState | null {
  const holders = hiddenHolders(game, role);
  if (holders.length < 2) return null;
  const a = holders[Math.floor(rand() * holders.length)];
  const rest = holders.filter((h) => h !== a);
  const b = rest[Math.floor(rand() * rest.length)];
  if (a === undefined || b === undefined) return null;
  const ca = [...cardsOf(game, a)];
  const cb = [...cardsOf(game, b)];
  const ia = Math.floor(rand() * ca.length);
  const ib = Math.floor(rand() * cb.length);
  const x = ca[ia];
  const y = cb[ib];
  if (x === undefined || y === undefined) return null;
  ca[ia] = y;
  cb[ib] = x;
  return withCards(withCards(game, a, ca), b, cb);
}

/** Every state of a game played by normal bots. */
function statesOf(seed: number): GameState[] {
  const rand = mulberry32(seed);
  const states: GameState[] = [];
  let state = newGame(seed);
  while (state.phase !== 'finished' && state.turn !== null) {
    states.push(state);
    const result = applyAction(state, state.turn, botAction(state, state.turn, 'normal', rand));
    if (!result.ok) throw new Error(result.error.message);
    state = result.value;
  }
  return states;
}

describe('fairness: bots never use cards they cannot see', () => {
  it('gives the same view and normal action when hidden cards are swapped', () => {
    const rand = mulberry32(99);
    let compared = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const state of statesOf(seed)) {
        const role = state.turn;
        if (role === null) continue;
        const other = swapHidden(state, role, rand);
        if (other === null) continue;
        expect(botViewOf(other, role)).toEqual(botViewOf(state, role));
        expect(chooseBotAction(botViewOf(other, role), 'normal', mulberry32(1))).toEqual(
          chooseBotAction(botViewOf(state, role), 'normal', mulberry32(1)),
        );
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(500);
  });

  it('gives the same strong action when hidden cards are swapped', () => {
    const rand = mulberry32(7);
    let compared = 0;
    for (let seed = 1; seed <= 6 && compared < 24; seed++) {
      for (const state of statesOf(seed).filter((s) => s.phase !== 'playing' || s.tricks.length % 3 === 1)) {
        const role = state.turn;
        if (role === null) continue;
        const other = swapHidden(state, role, rand);
        if (other === null) continue;
        expect(chooseBotAction(botViewOf(other, role), 'strong', mulberry32(3))).toEqual(
          chooseBotAction(botViewOf(state, role), 'strong', mulberry32(3)),
        );
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(10);
  }, 60_000);

  it('shows the Skat and the discard only to the declarer who picked up', () => {
    const state = stateWith({
      phase: 'declaring',
      declarer: 'forehand',
      pickedUpSkat: true,
      skat: hand('C7 C8'),
      discarded: hand('D7 D8'),
      turn: 'forehand',
    });
    expect(botViewOf(state, 'forehand')).toMatchObject({ ownSkat: ['C7', 'C8'], ownDiscard: ['D7', 'D8'] });
    expect(botViewOf(state, 'middlehand')).toMatchObject({ ownSkat: [], ownDiscard: [] });
  });

  it('shows an ouvert declarer hand to the defenders only during play', () => {
    const declaration = { kind: 'null', hand: true, ouvert: true } as const;
    const state = stateWith({ phase: 'playing', declarer: 'forehand', declaration, turn: 'forehand' });
    expect(botViewOf(state, 'middlehand').openHands.forehand).toEqual(state.hands.forehand);
    expect(botViewOf(state, 'forehand').openHands).toEqual({});
    expect(botViewOf({ ...state, declaration: { ...declaration, ouvert: false } }, 'middlehand').openHands).toEqual({});
  });
});

describe('voidsOf', () => {
  const hearts = { kind: 'suit', trump: 'H' } as const;

  it('marks a player who does not follow the led suit', () => {
    const voids = voidsOf(
      [{ leader: 'forehand', plays: [{ role: 'forehand', card: 'CA' }, { role: 'middlehand', card: 'S7' }, { role: 'hindhand', card: 'C7' }] }],
      hearts,
    );
    expect(voids).toEqual({ forehand: [], middlehand: ['C'], hindhand: [] });
  });

  it('treats Jacks as trump and trump leads as the trump suit', () => {
    const voids = voidsOf(
      [{ leader: 'forehand', plays: [{ role: 'forehand', card: 'CJ' }, { role: 'middlehand', card: 'H7' }, { role: 'hindhand', card: 'C8' }] }],
      hearts,
    );
    expect(voids).toEqual({ forehand: [], middlehand: [], hindhand: ['trump'] });
  });

  it('knows no voids before the game is declared', () => {
    expect(voidsOf([], null)).toEqual({ forehand: [], middlehand: [], hindhand: [] });
  });
});
