// A hosted table survives a restart of its host (docs/05-networking.md §9). The snapshot goes
// through JSON, as it does in localStorage; the host is started again from it with every human
// disconnected, and the clients rejoin with their tokens and carry on with the same game.

import { describe, expect, it } from 'vitest';
import { setConnected, type TableState } from '../table';
import { createHost, type HostSnapshot } from './host';
import type { ConnectionEvent, GameConnection } from './connection';
import { createRig, joinClient, lastView, nextCommand, settle, statusOf, type Rig } from './testing';

interface Party {
  readonly connection: GameConnection;
  readonly events: ConnectionEvent[];
}

function listen(connection: GameConnection): Party {
  const events: ConnectionEvent[] = [];
  connection.subscribe((e) => events.push(e));
  return { connection, events };
}

/** Every party sends the action its own view offers, then the messages are delivered. */
function playRound(rig: Rig, parties: readonly Party[]): void {
  for (const p of parties) {
    const command = nextCommand(lastView(p.events));
    if (command !== null) p.connection.send(command);
  }
  settle(rig);
}

/** What a host restart does with the humans: they are disconnected until they rejoin. */
function withHumansDisconnected(table: TableState): TableState {
  const humans = [...table.players, ...table.pending].filter((p) => !p.isBot && p.id !== table.hostId);
  return humans.reduce((state, p) => setConnected(state, p.id, false), table);
}

describe('resuming a hosted table', () => {
  it('lets the clients continue the same game after the host restarts from its snapshot', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    const ben = joinClient(rig, 'B', 'Ben');
    settle(rig);
    const host = listen(rig.host.connection);
    rig.host.connection.send({ type: 'start' });
    settle(rig);
    playRound(rig, [host, listen(anna.connection), listen(ben.connection)]);

    const annaId = anna.connection.playerId();
    const benId = ben.connection.playerId();
    const phaseBefore = rig.host.getState().game?.engine.phase;
    const handBefore = lastView(anna.events)?.game?.myHand;
    const storedJson = JSON.stringify(rig.host.snapshot());

    rig.net.drop('H');
    settle(rig);
    expect(statusOf(anna.events)).toBe('host-lost');

    const saved = JSON.parse(storedJson) as HostSnapshot;
    const resumed = createHost({
      transport: rig.net.transportFor('H'),
      table: withHumansDisconnected(saved.table),
      tokens: saved.tokens,
      now: () => 2000,
      randomSeed: () => 9,
    });
    settle(rig);

    expect(statusOf(anna.events)).toBe('connected');
    expect(anna.connection.playerId()).toBe(annaId);
    expect(ben.connection.playerId()).toBe(benId);
    expect(resumed.getState().players.every((p) => p.connected)).toBe(true);
    expect(resumed.getState().game?.engine.phase).toBe(phaseBefore);
    expect(lastView(anna.events)?.game?.myHand).toEqual(handBefore);

    const resumedHost = listen(resumed.connection);
    const parties = [resumedHost, listen(anna.connection), listen(ben.connection)];
    for (let round = 0; round < 400 && resumed.getState().game?.engine.phase !== 'finished'; round++) {
      playRound(rig, parties);
    }
    expect(resumed.getState().game?.engine.phase).toBe('finished');
    for (const p of parties) p.connection.send({ type: 'ready' });
    settle(rig);

    expect(resumed.getState().records).toHaveLength(1);
    expect(anna.events.filter((e) => e.t === 'record')).toHaveLength(1);
  });
});
