import { describe, expect, it } from 'vitest';
import { ctxFor, tableWith } from './testing';
import { createTable } from './table';
import { applyCommand } from './table';
import type { Ctx, PlayerId, TableCommand, TableErrorCode, TableState } from './types';

const CTX: Ctx = ctxFor(42, 1000);
const RAMSCH_ON = { type: 'set-rules', rules: { ramsch: true, bock: false, kontra: false } } as const;
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
    expect(tableWith(3).rules).toEqual({ ramsch: false, bock: false, kontra: false });
  });

  it('lets the host turn Ramsch on in the lobby', () => {
    const s = apply(tableWith(3), 'p0', RAMSCH_ON);
    expect(s.rules).toEqual({ ramsch: true, bock: false, kontra: false });
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
    expect(started.game?.engine.options).toEqual({ ramschOnPassIn: true, kontra: false });
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

describe('Kontra and Re table rule (skat-rules §14)', () => {
  const created = (): TableState => createTable({ key: 'TESTKEY', name: 'Test', isPublic: false, hostId: 'p0', hostName: 'Host' });

  it('is off when the table is created', () => {
    expect(created().rules.kontra).toBe(false);
  });

  it('the host can switch it in the lobby with set-rules', () => {
    const on = apply(created(), 'p0', { type: 'set-rules', rules: { ramsch: false, bock: false, kontra: true } });
    expect(on.rules).toEqual({ ramsch: false, bock: false, kontra: true });
    const off = apply(on, 'p0', { type: 'set-rules', rules: { ramsch: true, bock: false, kontra: false } });
    expect(off.rules).toEqual({ ramsch: true, bock: false, kontra: false });
  });

  it('applies to the next deal only', () => {
    const running = apply(apply(apply(created(), 'p0', { type: 'add-bot' }), 'p0', { type: 'add-bot' }), 'p0', { type: 'start' });
    const result = applyCommand(running, 'p0', { type: 'set-rules', rules: { ramsch: false, bock: false, kontra: true } }, CTX);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('GAME_RUNNING');
  });

  it('a Kontra change reaches the engine of the next game', () => {
    const s = apply(created(), 'p0', { type: 'set-rules', rules: { ramsch: false, bock: false, kontra: true } });
    const started = apply(apply(apply(s, 'p0', { type: 'add-bot' }), 'p0', { type: 'add-bot' }), 'p0', { type: 'start' });
    expect(started.game?.engine.options.kontra).toBe(true);
  });

  it('passes the rule to every game dealt at the table', () => {
    let s = apply(created(), 'p0', { type: 'set-rules', rules: { ramsch: false, bock: false, kontra: true } });
    s = apply(s, 'p0', { type: 'add-bot' });
    s = apply(s, 'p0', { type: 'add-bot' });
    s = apply(s, 'p0', { type: 'start' });
    expect(s.game?.engine.options.kontra).toBe(true);
  });
});
