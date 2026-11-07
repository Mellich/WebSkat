import { describe, expect, it } from 'vitest';
import type { CardId, Declaration, GameState, Role, Trick } from '../../engine';
import { hand, stateWith } from '../../engine/testing';
import { heuristicCard } from './heuristics';
import { botViewOf } from './knowledge';

const hearts: Declaration = { kind: 'suit', trump: 'H', hand: false, announce: 'none', ouvert: false };
const spades: Declaration = { kind: 'suit', trump: 'S', hand: false, announce: 'none', ouvert: false };
const nullGame: Declaration = { kind: 'null', hand: false, ouvert: false };

function playing(args: {
  declaration: Declaration;
  declarer: Role;
  me: Role;
  myHand: string;
  trick: Trick;
}): GameState {
  const hands = { forehand: hand('C7'), middlehand: hand('C8'), hindhand: hand('C9'), [args.me]: hand(args.myHand) };
  return stateWith({
    phase: 'playing',
    declaration: args.declaration,
    declarer: args.declarer,
    bid: 18,
    hands,
    trick: args.trick,
    tricks: [],
    turn: args.me,
  });
}

function choose(state: GameState): CardId {
  const role = state.turn;
  if (role === null) throw new Error('nobody on turn');
  return heuristicCard(botViewOf(state, role));
}

describe('normal card play', () => {
  it('lets a defender give points to the partner who wins after the declarer played', () => {
    const state = playing({
      declaration: hearts,
      declarer: 'forehand',
      me: 'hindhand',
      myHand: 'C10 CK S7 S8',
      trick: { leader: 'forehand', plays: [{ role: 'forehand', card: 'C7' }, { role: 'middlehand', card: 'CA' }] },
    });
    expect(choose(state)).toBe('C10');
  });

  it('lets the declarer draw trumps with the top trump', () => {
    const state = playing({
      declaration: hearts,
      declarer: 'forehand',
      me: 'forehand',
      myHand: 'CJ SJ HA H10 H7 SA S10 D7 D8 C7',
      trick: { leader: 'forehand', plays: [] },
    });
    expect(choose(state)).toBe('CJ');
  });

  it('lets the declarer take a valuable trick with a safe winner', () => {
    const state = playing({
      declaration: hearts,
      declarer: 'hindhand',
      me: 'hindhand',
      myHand: 'SA S7 D8',
      trick: { leader: 'forehand', plays: [{ role: 'forehand', card: 'S10' }, { role: 'middlehand', card: 'SK' }] },
    });
    expect(choose(state)).toBe('SA');
  });

  it('keeps the Null declarer under the trick', () => {
    const state = playing({
      declaration: nullGame,
      declarer: 'middlehand',
      me: 'middlehand',
      myHand: 'HJ H9 H8 C7',
      trick: { leader: 'forehand', plays: [{ role: 'forehand', card: 'H10' }] },
    });
    expect(choose(state)).toBe('H9');
  });

  it('does not trump a trick the partner is safely winning', () => {
    const state = playing({
      declaration: spades,
      declarer: 'hindhand',
      me: 'middlehand',
      myHand: 'S7 D10 DK',
      trick: { leader: 'forehand', plays: [{ role: 'forehand', card: 'CA' }] },
    });
    expect(choose(state)).toBe('D10');
  });

  it('lets a Null defender stay under the declarer who is winning', () => {
    const state = playing({
      declaration: nullGame,
      declarer: 'forehand',
      me: 'hindhand',
      myHand: 'H7 HQ HA',
      trick: { leader: 'forehand', plays: [{ role: 'forehand', card: 'HK' }, { role: 'middlehand', card: 'H8' }] },
    });
    expect(choose(state)).toBe('HQ');
  });
});
