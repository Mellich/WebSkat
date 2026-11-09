// The host writes join, reconnect, disconnect and leave entries into the game log (plan 10).

import { describe, expect, it } from 'vitest';
import { createRig, joinClient, settle } from './testing';

const kindsOf = (rig: ReturnType<typeof createRig>) => rig.host.getState().log.map((e) => e.kind);

describe('log of connection events', () => {
  it('logs a join with the name the table stored', () => {
    const rig = createRig();
    joinClient(rig, 'A', 'Anna');
    settle(rig);
    expect(rig.host.getState().log.at(-1)).toMatchObject({
      kind: 'joined',
      playerId: 'id1',
      name: 'Anna',
      isBot: false,
      pending: false,
    });
  });

  it('logs a disconnect once, and a reconnect with the token', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    const token = anna.tokens[0] ?? '';
    anna.connection.close();
    settle(rig);
    expect(rig.host.getState().log.at(-1)).toMatchObject({ kind: 'disconnected', playerId: 'id1', name: 'Anna' });

    joinClient(rig, 'A2', 'Anna', token);
    settle(rig);
    expect(rig.host.getState().log.at(-1)).toMatchObject({ kind: 'reconnected', playerId: 'id1', name: 'Anna' });
  });

  it('does not log a second tab that rejoins a player who is still connected', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    const before = rig.host.getState().log.length;
    joinClient(rig, 'A2', 'Anna', anna.tokens[0] ?? '');
    settle(rig);
    expect(rig.host.getState().log).toHaveLength(before);
  });

  it('logs a leave instead of a disconnect', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    anna.connection.leave();
    settle(rig);
    expect(kindsOf(rig).slice(-2)).toEqual(['joined', 'left']);
    expect(rig.host.getState().log.at(-1)).toMatchObject({ kind: 'left', playerId: 'id1', name: 'Anna' });
  });
});
