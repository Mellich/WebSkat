import { describe, expect, it } from 'vitest';
import { ctxFor, tableWith } from './testing';
import { applyCommand } from './table';
import type { Ctx, PlayerId, TableCommand, TableErrorCode, TableState } from './types';

const CTX: Ctx = ctxFor(42, 1000);
const RAMSCH_ON = { type: 'set-rules', rules: { ramsch: true } } as const;
const PASS = { type: 'game', action: { type: 'pass' } } as const;

function apply(s: TableState, actor: PlayerId, c: TableCommand, ctx: Ctx = CTX): TableState {
  const result = applyCommand(s, actor, c, ctx);
  if (!result.ok) throw new Error(`${c.type} by ${actor} rejected: ${result.error.code}`);
  return result.value.state;
}

function errorOf(s: TableState, actor: PlayerId, c: TableCommand): TableErrorCode {
  const result = applyCommand(s, actor, c, CTX);
  if (result.ok) throw new Error(`${c.type} by ${actor} was accepted`);
  return result.error.code;
}

describe('set-rules', () => {
  it('starts with every table rule off', () => {
    expect(tableWith(3).rules).toEqual({ ramsch: false });
  });

  it('lets the host turn Ramsch on in the lobby', () => {
    const s = apply(tableWith(3), 'p0', RAMSCH_ON);
    expect(s.rules).toEqual({ ramsch: true });
  });

  it('is for the host only', () => {
    expect(errorOf(tableWith(3), 'p1', RAMSCH_ON)).toBe('NOT_HOST');
  });

  it('is refused while a game runs', () => {
    const running = apply(tableWith(3), 'p0', { type: 'start' });
    expect(errorOf(running, 'p0', RAMSCH_ON)).toBe('GAME_RUNNING');
  });

  it('is passed to the engine when the next game is dealt', () => {
    const started = apply(apply(tableWith(3), 'p0', RAMSCH_ON), 'p0', { type: 'start' });
    expect(started.game?.engine.options).toEqual({ ramschOnPassIn: true });
  });

  it('with the rule on, three passes start a Ramsch instead of a passed-in game', () => {
    let s = apply(apply(tableWith(3), 'p0', RAMSCH_ON), 'p0', { type: 'start' });
    const game = s.game;
    if (game === null) throw new Error('no game');
    for (const id of [game.roles.middlehand, game.roles.hindhand, game.roles.forehand]) {
      s = apply(s, id, PASS);
    }
    expect(s.game?.engine.phase).toBe('playing');
    expect(s.game?.engine.ramsch).toBe(true);
    expect(s.game?.engine.turn).toBe('forehand');
  });

  it('with the rule off, three passes end the game as passed-in', () => {
    let s = apply(tableWith(3), 'p0', { type: 'start' });
    const game = s.game;
    if (game === null) throw new Error('no game');
    for (const id of [game.roles.middlehand, game.roles.hindhand, game.roles.forehand]) {
      s = apply(s, id, PASS);
    }
    expect(s.game?.engine.phase).toBe('finished');
    expect(s.game?.engine.result).toEqual({ kind: 'passed-in' });
  });
});
