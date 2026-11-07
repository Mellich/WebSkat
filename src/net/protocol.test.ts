import { describe, expect, it } from 'vitest';
import { addPlayer, applyCommand, createTable, viewFor, type TableState } from '../table';
import { AdSchema, ClientMessageSchema, HostMessageSchema } from './protocol';
import { GameRecordSchema, TableViewSchema } from './schemaView';
import { GameActionSchema, TableCommandSchema } from './schemaGame';

const TOKEN = 'a'.repeat(32);

describe('client messages', () => {
  it.each([
    ['a join without token', { t: 'join', v: 1, name: 'Anna' }],
    ['a join with token', { t: 'join', v: 1, name: 'Anna', token: TOKEN }],
    ['a start command', { t: 'cmd', command: { type: 'start' } }],
    ['a bid', { t: 'cmd', command: { type: 'game', action: { type: 'bid', value: 18 } } }],
    ['a discard', { t: 'cmd', command: { type: 'game', action: { type: 'discard', cards: ['CJ', 'S10'] } } }],
    ['a declaration', { t: 'cmd', command: { type: 'game', action: { type: 'declare', declaration: { kind: 'null', hand: false, ouvert: false } } } }],
    ['a kick', { t: 'cmd', command: { type: 'kick', playerId: 'p2' } }],
  ])('accepts %s', (_name, message) => {
    expect(ClientMessageSchema.safeParse(message).success).toBe(true);
  });

  it.each([
    ['an unknown card id', { t: 'cmd', command: { type: 'game', action: { type: 'play', card: 'XX' } } }],
    ['a rank that does not exist', { t: 'cmd', command: { type: 'game', action: { type: 'play', card: 'C6' } } }],
    ['a bid that is not a bid value', { t: 'cmd', command: { type: 'game', action: { type: 'bid', value: 19 } } }],
    ['an unknown message type', { t: 'hello', v: 1 }],
    ['a command type that does not exist', { t: 'cmd', command: { type: 'shuffle' } }],
    ['a join without a name', { t: 'join', v: 1 }],
    ['a name longer than 40 characters', { t: 'join', v: 1, name: 'x'.repeat(41) }],
    ['an empty name', { t: 'join', v: 1, name: '' }],
    ['a malformed token', { t: 'join', v: 1, name: 'Anna', token: 'not-hex' }],
    ['a missing command', { t: 'cmd' }],
    ['a non-object', 'join'],
    ['a discard with only one card', { t: 'cmd', command: { type: 'game', action: { type: 'discard', cards: ['CJ'] } } }],
  ])('rejects %s', (_name, message) => {
    expect(ClientMessageSchema.safeParse(message).success).toBe(false);
  });

  it('validates the game action and command schemas on their own', () => {
    expect(GameActionSchema.safeParse({ type: 'pass' }).success).toBe(true);
    expect(TableCommandSchema.safeParse({ type: 'leave' }).success).toBe(true);
    expect(TableCommandSchema.safeParse({ type: 'kick' }).success).toBe(false);
  });
});

describe('host messages', () => {
  it.each([
    ['a welcome', { t: 'welcome', v: 2, playerId: 'p1', token: TOKEN }],
    ['a rejection', { t: 'rejected', reason: 'TABLE_FULL' }],
    ['a kick notice', { t: 'kicked' }],
    ['a close notice', { t: 'closed' }],
    ['an error', { t: 'error', code: 'NOT_HOST', message: 'Only the host can do this.' }],
  ])('accepts %s', (_name, message) => {
    expect(HostMessageSchema.safeParse(message).success).toBe(true);
  });

  it.each([
    ['an unknown rejection reason', { t: 'rejected', reason: 'BANNED' }],
    ['a welcome without token', { t: 'welcome', v: 1, playerId: 'p1' }],
    ['an unknown message type', { t: 'secret', v: 1 }],
  ])('rejects %s', (_name, message) => {
    expect(HostMessageSchema.safeParse(message).success).toBe(false);
  });
});

describe('advertisements', () => {
  const ad = {
    t: 'ad',
    v: 2,
    key: 'ABCD-EFGH',
    name: 'Friday game',
    hostName: 'Anna',
    seats: 2,
    maxSeats: 6,
    status: 'lobby',
    ts: 1000,
  };

  it('accepts a valid advertisement', () => {
    expect(AdSchema.safeParse(ad).success).toBe(true);
  });

  it.each([
    ['an invalid key', { ...ad, key: 'ABCD-EF0G' }],
    ['more seats than allowed', { ...ad, maxSeats: 7 }],
    ['an unknown status', { ...ad, status: 'paused' }],
  ])('rejects %s', (_name, message) => {
    expect(AdSchema.safeParse(message).success).toBe(false);
  });
});

describe('real views and records from the table layer', () => {
  function playedPassIn(): TableState {
    let s = createTable({ key: 'ABCD-EFGH', name: 'Friday', isPublic: true, hostId: 'h', hostName: 'Host', maxSeats: 6 });
    for (const name of ['Anna', 'Ben']) {
      const added = addPlayer(s, { id: name.toLowerCase(), name });
      if (!added.ok) throw new Error(added.error.message);
      s = added.value;
    }
    const ctx = { now: 5, seed: 99 };
    const started = applyCommand(s, 'h', { type: 'start' }, ctx);
    if (!started.ok) throw new Error(started.error.message);
    s = started.value.state;
    const roles = s.game?.roles;
    for (const id of [roles?.middlehand, roles?.hindhand, roles?.forehand]) {
      const result = applyCommand(s, id ?? '', { type: 'game', action: { type: 'pass' } }, ctx);
      if (!result.ok) throw new Error(result.error.message);
      s = result.value.state;
    }
    return s;
  }

  it('parses the view of every seat, the lobby and a game in progress', () => {
    const s = playedPassIn();
    for (const viewer of ['h', 'anna', 'ben', 'stranger']) {
      expect(TableViewSchema.safeParse(viewFor(s, viewer)).success).toBe(true);
    }
  });

  it('parses the game records', () => {
    const s = playedPassIn();
    expect(s.records).toHaveLength(1);
    expect(GameRecordSchema.safeParse(s.records[0]).success).toBe(true);
  });
});
