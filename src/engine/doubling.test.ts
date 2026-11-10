import { describe, expect, it } from 'vitest';
import { applyAction } from './game';
import { enumerateActions, getLegal } from './legal';
import { DECLARE_HEARTS, afterDiscard, apply, run } from './testing';
import { DEFAULT_GAME_OPTIONS } from './types';
import type { GameAction, GameErrorCode, GameState, Role } from './types';

/** Middlehand is the declarer; forehand and hindhand are the defenders (skat-rules §14). The table rule is on. */
function withKontra(): GameState {
  return { ...afterDiscard(), options: { ...DEFAULT_GAME_OPTIONS, kontra: true } };
}

function declared(): GameState {
  return apply(withKontra(), 'middlehand', DECLARE_HEARTS);
}

function errorCode(state: GameState, role: Role, action: GameAction): GameErrorCode {
  const result = applyAction(state, role, action);
  if (result.ok) {
    throw new Error(`expected ${role} ${action.type} to be rejected`);
  }
  return result.error.code;
}

const KONTRA: GameAction = { type: 'kontra' };
const RE: GameAction = { type: 're' };
const NO_DOUBLE: GameAction = { type: 'no-double' };

describe('doubling window after the declaration (skat-rules §14)', () => {
  it('without the table rule the play starts at once', () => {
    const state = apply(afterDiscard(), 'middlehand', DECLARE_HEARTS);
    expect(state).toMatchObject({ phase: 'playing', turn: 'forehand', doubling: 1 });
  });

  it('opens after declare with the first defender in turn and level 1', () => {
    const state = declared();
    expect(state).toMatchObject({
      phase: 'doubling',
      turn: 'forehand',
      doubling: 1,
      doublePassed: [],
      trick: { plays: [] },
    });
  });

  it('lets only defenders act at level 1', () => {
    expect(errorCode(declared(), 'middlehand', RE)).toBe('NOT_YOUR_TURN');
    expect(errorCode(declared(), 'middlehand', NO_DOUBLE)).toBe('NOT_YOUR_TURN');
  });

  it('kontra doubles and hands the turn to the declarer', () => {
    const state = apply(declared(), 'forehand', KONTRA);
    expect(state).toMatchObject({ phase: 'doubling', doubling: 2, turn: 'middlehand' });
  });

  it('re quadruples and starts the play with forehand leading', () => {
    const state = run(declared(), [
      ['forehand', KONTRA],
      ['middlehand', RE],
    ]);
    expect(state).toMatchObject({ phase: 'playing', doubling: 4, turn: 'forehand' });
  });

  it('the declarer may skip re after kontra and the play starts at level 2', () => {
    const state = run(declared(), [
      ['forehand', KONTRA],
      ['middlehand', NO_DOUBLE],
    ]);
    expect(state).toMatchObject({ phase: 'playing', doubling: 2, turn: 'forehand' });
  });

  it('kontra is only offered to defenders, and the declarer cannot kontra', () => {
    expect(errorCode(declared(), 'middlehand', KONTRA)).toBe('NOT_YOUR_TURN');
    const afterKontra = apply(declared(), 'forehand', KONTRA);
    expect(errorCode(afterKontra, 'forehand', RE)).toBe('NOT_YOUR_TURN');
  });

  it('after kontra the second defender is not asked again', () => {
    const state = apply(declared(), 'forehand', KONTRA);
    expect(getLegal(state, 'hindhand')).toEqual({});
    expect(errorCode(state, 'hindhand', KONTRA)).toBe('NOT_YOUR_TURN');
  });

  it('no-double by both defenders starts the play at level 1', () => {
    const state = run(declared(), [
      ['forehand', NO_DOUBLE],
      ['hindhand', NO_DOUBLE],
    ]);
    expect(state).toMatchObject({ phase: 'playing', doubling: 1, turn: 'forehand' });
  });

  it('a defender who passed is skipped, the next defender may still kontra', () => {
    const state = run(declared(), [['forehand', NO_DOUBLE]]);
    expect(state).toMatchObject({ phase: 'doubling', turn: 'hindhand', doublePassed: ['forehand'] });
    expect(apply(state, 'hindhand', KONTRA)).toMatchObject({ doubling: 2, turn: 'middlehand' });
  });

  it('re and no-double are wrong at level 1 even for the right player', () => {
    const state = run(declared(), [['forehand', NO_DOUBLE]]);
    expect(errorCode(state, 'hindhand', RE)).toBe('WRONG_PHASE');
  });

  it('bidding and play actions are wrong in the doubling phase', () => {
    expect(errorCode(declared(), 'forehand', { type: 'play', card: 'CA' })).toBe('WRONG_PHASE');
    expect(errorCode(declared(), 'forehand', { type: 'pass' })).toBe('WRONG_PHASE');
  });

  it('getLegal and enumerateActions offer the doubling choices to the acting role only', () => {
    const state = declared();
    expect(getLegal(state, 'forehand')).toEqual({ canKontra: true, canNoDouble: true });
    expect(enumerateActions(state, 'forehand')).toEqual([KONTRA, NO_DOUBLE]);
    expect(enumerateActions(state, 'middlehand')).toEqual([]);
    const afterKontra = apply(state, 'forehand', KONTRA);
    expect(getLegal(afterKontra, 'middlehand')).toEqual({ canRe: true, canNoDouble: true });
  });

  it('works for Null and ouvert declarations too', () => {
    const nullState = apply(withKontra(), 'middlehand', {
      type: 'declare',
      declaration: { kind: 'null', hand: false, ouvert: false },
    });
    expect(nullState.phase).toBe('doubling');
    const started = run(nullState, [
      ['forehand', KONTRA],
      ['middlehand', RE],
    ]);
    expect(started).toMatchObject({ phase: 'playing', doubling: 4 });
  });
});

describe('doubling in the result', () => {
  it('a finished played game carries the doubling level of its Kontra', () => {
    let state = run(declared(), [
      ['forehand', KONTRA],
      ['middlehand', NO_DOUBLE],
    ]);
    // Play the whole game with the first legal action of whoever is on turn.
    while (state.phase !== 'finished') {
      const role = state.turn;
      if (role === null) throw new Error('no turn during play');
      const action = enumerateActions(state, role)[0];
      if (action === undefined) throw new Error('no legal action');
      state = apply(state, role, action);
    }
    expect(state.result).toMatchObject({ kind: 'played', doubling: 2 });
  });
});
