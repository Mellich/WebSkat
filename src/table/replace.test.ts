import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine';
import { addPlayer } from './seating';
import { botStep } from './bot';
import { ctxFor, playUntilRecords, tableWith } from './testing';
import { applyCommand } from './table';
import { viewFor } from './view';
import type { Ctx, ReplaceBy, TableState } from './types';

const ctxOf = (seed: number) => (): Ctx => ctxFor(seed);

function started(count: number, seed = 7): TableState {
  const result = applyCommand(tableWith(count), 'p0', { type: 'start' }, ctxFor(seed));
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
}

function withPending(s: TableState, id: string, name: string): TableState {
  const added = addPlayer(s, { id, name });
  if (!added.ok) throw new Error(added.error.message);
  return added.value;
}

function finished(s: TableState, seed: number): TableState {
  const done = playUntilRecords(s, s.records.length + 1, ctxOf(seed), mulberry32(seed));
  if (done.game?.engine.phase !== 'finished') throw new Error('game did not finish');
  return done;
}

function replace(s: TableState, actor: string, target: string, by: ReplaceBy) {
  return applyCommand(s, actor, { type: 'replace-player', playerId: target, by }, ctxFor(7));
}

describe('replace-player', () => {
  it('gives a pending player the seat, role and hand of the replaced player', () => {
    const s = withPending(started(3), 'cid', 'Carl');
    const result = replace(s, 'p0', 'p1', { kind: 'pending', playerId: 'cid' });
    if (!result.ok) throw new Error(result.error.message);
    const next = result.value.state;
    expect(next.players[1]?.id).toBe('cid');
    expect(next.pending).toEqual([]);
    const game = next.game;
    if (game === null) throw new Error('no game');
    const role = (['forehand', 'middlehand', 'hindhand'] as const).find((r) => game.roles[r] === 'cid');
    expect(role).toBeDefined();
    if (role === undefined) return;
    const view = viewFor(next, 'cid');
    expect(view.you.role).toBe(role);
    expect(view.game?.myHand).toEqual(game.engine.hands[role]);
    expect(viewFor(next, 'p1').you.role).toBe('lobby');
  });

  it('replaces a player on turn by a bot, which can then act', () => {
    // A deal where a guest (not the host) is on turn.
    const s = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => started(3, seed)).find((t) => {
      const turn = t.game?.engine.turn;
      return turn != null && t.game?.roles[turn] !== 'p0';
    });
    const game = s?.game;
    if (s === undefined || game?.engine.turn == null) throw new Error('no guest on turn');
    const onTurn = game.roles[game.engine.turn];
    const result = replace(s, 'p0', onTurn, { kind: 'bot', level: 'easy' });
    if (!result.ok) throw new Error(result.error.message);
    const after = botStep(result.value.state, ctxOf(7), mulberry32(3));
    expect(after).not.toBeNull();
    expect(after?.seq).toBeGreaterThan(result.value.state.seq);
  });

  it('moves the sitting-out role and the dealer to the new player', () => {
    const s = withPending(started(4), 'cid', 'Carl');
    const game = s.game;
    const sitter = game?.sittingOut[0];
    if (game === null || sitter === undefined) throw new Error('no sitting-out player');
    const result = replace(s, 'p0', sitter, { kind: 'pending', playerId: 'cid' });
    if (!result.ok) throw new Error(result.error.message);
    const after = result.value.state.game;
    expect(after?.sittingOut).toContain('cid');
    expect(after?.sittingOut).not.toContain(sitter);
    if (game.dealerId === sitter) expect(after?.dealerId).toBe('cid');
  });

  it('keeps the next game waiting for humans in a finished game, and deals when all are ready', () => {
    const done = finished(started(3), 11);
    const pressed = applyCommand(done, 'p0', { type: 'ready' }, ctxFor(11));
    if (!pressed.ok) throw new Error(pressed.error.message);
    const waiting = pressed.value.state;
    const result = replace(waiting, 'p0', 'p1', { kind: 'bot', level: 'normal' });
    if (!result.ok) throw new Error(result.error.message);
    const bot = result.value.state.players[1];
    expect(bot?.isBot).toBe(true);
    expect(result.value.state.game?.engine.phase).toBe('finished');
    expect(result.value.state.ready).toContain(bot?.id);
    expect(result.value.state.ready).not.toContain('p1');

    const lastHuman = applyCommand(waiting, 'p2', { type: 'ready' }, ctxFor(11));
    if (!lastHuman.ok) throw new Error(lastHuman.error.message);
    const dealt = replace(lastHuman.value.state, 'p0', 'p1', { kind: 'bot', level: 'normal' });
    if (!dealt.ok) throw new Error(dealt.error.message);
    expect(dealt.value.state.game?.number).toBe(2);
    expect(dealt.value.state.game?.engine.phase).not.toBe('finished');
  });

  it('works in the lobby and keeps the seat count', () => {
    const result = replace(tableWith(3), 'p0', 'p1', { kind: 'bot', level: 'strong' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.state.players).toHaveLength(3);
    expect(result.value.state.players[1]).toMatchObject({ isBot: true, botLevel: 'strong' });
  });

  it('rejects invalid replacements and leaves the state unchanged', () => {
    const s = withPending(started(3), 'cid', 'Carl');
    const before = JSON.stringify(s);
    const expectError = (actor: string, target: string, by: ReplaceBy, code: string) => {
      const result = replace(s, actor, target, by);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(code);
    };
    expectError('p1', 'p2', { kind: 'bot', level: 'normal' }, 'NOT_HOST');
    expectError('p0', 'p0', { kind: 'bot', level: 'normal' }, 'CANNOT_KICK_HOST');
    expectError('p0', 'ghost', { kind: 'bot', level: 'normal' }, 'UNKNOWN_PLAYER');
    expectError('p0', 'cid', { kind: 'bot', level: 'normal' }, 'UNKNOWN_PLAYER');
    expectError('p0', 'p1', { kind: 'pending', playerId: 'nobody' }, 'UNKNOWN_PLAYER');
    expect(JSON.stringify(s)).toBe(before);
  });
});
