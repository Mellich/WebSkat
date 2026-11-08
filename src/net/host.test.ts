import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './client';
import { createFakeNetwork } from './fake';
import { createHost } from './host';
import { tableRoom, JOIN_TIMEOUT_MS, LEAVE_CLOSE_DELAY_MS, PROTOCOL_VERSION } from './constants';
import { createRig, errorsOf, joinClient, KEY, lastView, settle, statusOf } from './testing';

import type { ConnectionEvent } from './connection';

afterEach(() => {
  vi.useRealTimers();
});

describe('joining', () => {
  it('welcomes a new player with a seat, the records and the table view', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    expect(anna.connection.playerId()).toBe('id1');
    expect(anna.tokens).toHaveLength(1);
    expect(statusOf(anna.events)).toBe('connected');
    expect(anna.events).toContainEqual({ t: 'records', records: [] });
    expect(lastView(anna.events)).toMatchObject({ you: { id: 'id1', seat: 1, role: 'lobby' } });
    expect(rig.host.getState().players.map((p) => p.name)).toEqual(['Host', 'Anna']);
  });

  it('shows every seated player to everybody', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    const ben = joinClient(rig, 'B', 'Ben');
    settle(rig);
    expect(lastView(anna.events)?.table.players.map((p) => p.name)).toEqual(['Host', 'Anna', 'Ben']);
    expect(lastView(ben.events)?.table.players.map((p) => p.name)).toEqual(['Host', 'Anna', 'Ben']);
  });

  it('rejects a protocol version that does not match', () => {
    const rig = createRig();
    const raw = rig.net.transportFor('X').join(tableRoom(KEY));
    const received: unknown[] = [];
    raw.onMessage((_c, data) => received.push(data));
    raw.send('cmd', { t: 'join', v: PROTOCOL_VERSION + 1, name: 'Old' }, 'H');
    settle(rig);
    expect(received).toEqual([{ t: 'rejected', reason: 'PROTOCOL_MISMATCH' }]);
    expect(rig.host.getState().players).toHaveLength(1);
  });

  it('rejects a join when the table is full', () => {
    const rig = createRig({ maxSeats: 3 });
    joinClient(rig, 'A', 'Anna');
    joinClient(rig, 'B', 'Ben');
    const late = joinClient(rig, 'C', 'Cid');
    settle(rig);
    expect(late.events).toContainEqual({ t: 'status', status: 'rejected', reason: 'TABLE_FULL' });
    expect(late.connection.playerId()).toBeNull();
    expect(rig.host.getState().players).toHaveLength(3);
  });

  it('lets a player reclaim the seat with the token after reconnecting', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    const token = anna.tokens[0] ?? '';
    anna.connection.close();
    settle(rig);
    expect(rig.host.getState().players.find((p) => p.name === 'Anna')?.connected).toBe(false);

    const again = joinClient(rig, 'A2', 'Anna', token);
    settle(rig);
    expect(again.connection.playerId()).toBe('id1');
    expect(rig.host.getState().players.filter((p) => p.name === 'Anna')).toHaveLength(1);
    expect(rig.host.getState().players.find((p) => p.name === 'Anna')?.connected).toBe(true);
  });
});

describe('commands', () => {
  it('ignores commands from peers that have not joined', () => {
    const rig = createRig();
    const raw = rig.net.transportFor('X').join(tableRoom(KEY));
    raw.send('cmd', { t: 'cmd', command: { type: 'add-bot' } }, 'H');
    settle(rig);
    expect(rig.host.getState().players).toHaveLength(1);
  });

  it('runs a command for the player who sent it: a client cannot act as the host', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    anna.connection.send({ type: 'start' });
    settle(rig);
    expect(errorsOf(anna.events)).toEqual(['NOT_HOST']);
    expect(rig.host.getState().status).toBe('lobby');
  });

  it('drops invalid messages without reaching the table', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    const raw = rig.net.transportFor('X').join(tableRoom(KEY));
    raw.send('cmd', { t: 'cmd', command: { type: 'game', action: { type: 'play', card: 'XX' } } }, 'H');
    raw.send('cmd', { garbage: true }, 'H');
    settle(rig);
    expect(errorsOf(anna.events)).toEqual([]);
    expect(rig.host.getState().gameCounter).toBe(0);
  });

  it('starts a game from the host connection and sends the views to the clients', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    const ben = joinClient(rig, 'B', 'Ben');
    settle(rig);
    rig.host.connection.send({ type: 'start' });
    settle(rig);
    expect(lastView(anna.events)?.game).not.toBeNull();
    expect(lastView(ben.events)?.game?.phase).toBe('bidding');
    expect(rig.host.getState().gameCounter).toBe(1);
  });

  it('runs every bot turn right away, without pauses, until a human must act', () => {
    const rig = createRig();
    rig.host.connection.send({ type: 'add-bot' });
    rig.host.connection.send({ type: 'add-bot' });
    rig.host.connection.send({ type: 'start' });
    settle(rig);
    const game = rig.host.getState().game;
    const turn = game?.engine.turn ?? null;
    expect(turn === null ? null : game?.roles[turn]).toBe('host');
  });

  it('closes the connection of a kicked player', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    const id = anna.connection.playerId() ?? '';
    rig.host.connection.send({ type: 'kick', playerId: id });
    settle(rig);
    expect(statusOf(anna.events)).toBe('kicked');
    expect(rig.host.getState().players.map((p) => p.id)).toEqual(['host']);
  });

  it('does not seat a kicked player again when another player joins the room', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    rig.host.connection.send({ type: 'kick', playerId: anna.connection.playerId() ?? '' });
    settle(rig);
    joinClient(rig, 'B', 'Ben');
    settle(rig);
    expect(rig.host.getState().players.map((p) => p.name)).toEqual(['Host', 'Ben']);
    expect(statusOf(anna.events)).toBe('kicked');
  });
});

describe('leaving', () => {
  it('sends the leave command, so the host removes the seat, then closes the client', () => {
    vi.useFakeTimers();
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    expect(rig.host.getState().players).toHaveLength(2);

    anna.connection.leave();
    settle(rig);
    expect(rig.host.getState().players.map((p) => p.name)).toEqual(['Host']);
    expect(statusOf(anna.events)).toBe('connected');

    vi.advanceTimersByTime(LEAVE_CLOSE_DELAY_MS);
    expect(statusOf(anna.events)).toBe('closed');
    expect(rig.net.members(tableRoom(KEY))).not.toContain('A');
  });

  it('a client without a host connection only closes after the delay and sends nothing', () => {
    vi.useFakeTimers();
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    rig.net.drop('H');
    settle(rig);
    expect(statusOf(anna.events)).toBe('host-lost');

    anna.connection.leave();
    settle(rig);
    expect(statusOf(anna.events)).toBe('host-lost');
    vi.advanceTimersByTime(LEAVE_CLOSE_DELAY_MS);
    expect(statusOf(anna.events)).toBe('closed');
  });

  it('the host leaving stops the table and closes every client', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    rig.host.connection.leave();
    settle(rig);
    expect(statusOf(anna.events)).toBe('closed');
  });
});

describe('shutdown and failures', () => {
  it('tells every client when the host stops', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    rig.host.stop();
    settle(rig);
    expect(statusOf(anna.events)).toBe('closed');
  });

  it('gives up after the join timeout when no host answers', () => {
    vi.useFakeTimers();
    const net = createFakeNetwork();
    const client = createClient({
      transport: net.transportFor('A'),
      key: KEY,
      name: 'Anna',
      onToken: () => undefined,
    });
    const events: ConnectionEvent[] = [];
    client.subscribe((e) => events.push(e));
    net.flush();
    vi.advanceTimersByTime(JOIN_TIMEOUT_MS - 1);
    expect(statusOf(events)).toBe('connecting');
    vi.advanceTimersByTime(1);
    expect(events).toContainEqual({ t: 'status', status: 'rejected', reason: 'TIMEOUT' });
  });

  it('marks clients host-lost when the host disappears, and recovers when it resumes', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    const id = anna.connection.playerId();
    const snapshot = rig.host.snapshot();

    rig.net.drop('H');
    settle(rig);
    expect(statusOf(anna.events)).toBe('host-lost');

    const resumed = createHost({
      transport: rig.net.transportFor('H'),
      table: snapshot.table,
      tokens: snapshot.tokens,
      now: () => 2000,
      randomSeed: () => 9,
    });
    settle(rig);
    expect(statusOf(anna.events)).toBe('connected');
    expect(anna.connection.playerId()).toBe(id);
    expect(resumed.getState().players.find((p) => p.name === 'Anna')?.connected).toBe(true);
  });

});
