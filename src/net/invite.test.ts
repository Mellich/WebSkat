// Invites and seat replacement over the fake network (docs/networking.md §4, plan 07).

import { describe, expect, it } from 'vitest';
import { ROLES, type CardId } from '../engine';
import { createHost } from './host';
import { CARD_PATTERN, createRig, joinClient, lastView, settle, statusOf, type Rig } from './testing';

function cardsIn(json: string): CardId[] {
  return (json.match(CARD_PATTERN) ?? []) as CardId[];
}

/** Host + Anna + Ben with a game started. */
function threePlayerGame(): { rig: Rig; anna: ReturnType<typeof joinClient>; ben: ReturnType<typeof joinClient> } {
  const rig = createRig();
  const anna = joinClient(rig, 'A', 'Anna');
  const ben = joinClient(rig, 'B', 'Ben');
  settle(rig);
  rig.host.connection.send({ type: 'start' });
  settle(rig);
  return { rig, anna, ben };
}

describe('invites', () => {
  it('lets a disconnected player take the seat back with an invite code', () => {
    const { rig, anna } = threePlayerGame();
    const annaId = anna.connection.playerId() ?? '';
    const oldToken = anna.tokens[0];
    rig.net.drop('A');
    settle(rig);

    const code = rig.host.invite(annaId);
    expect(code).not.toBeNull();
    const back = joinClient(rig, 'A2', 'Anna', undefined, code ?? undefined);
    settle(rig);

    expect(back.connection.playerId()).toBe(annaId);
    expect(back.tokens[0]).toBeDefined();
    expect(back.tokens[0]).not.toBe(oldToken);
    expect(statusOf(back.events)).toBe('connected');
    expect(lastView(back.events)?.game?.myHand).toHaveLength(10);
  });

  it('rejects an invite code that was already used', () => {
    const { rig, anna } = threePlayerGame();
    rig.net.drop('A');
    settle(rig);
    const code = rig.host.invite(anna.connection.playerId() ?? '') ?? '';
    joinClient(rig, 'A2', 'Anna', undefined, code);
    settle(rig);

    const again = joinClient(rig, 'A3', 'Anna', undefined, code);
    settle(rig);
    expect(again.events).toContainEqual({ t: 'status', status: 'rejected', reason: 'INVITE_INVALID' });
  });

  it('gives no invite for a connected player, the host or a bot', () => {
    const rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    settle(rig);
    rig.host.connection.send({ type: 'add-bot' });
    settle(rig);
    const botId = rig.host.getState().players.find((p) => p.isBot)?.id ?? '';

    expect(rig.host.invite(anna.connection.playerId() ?? '')).toBeNull();
    expect(rig.host.invite('host')).toBeNull();
    expect(rig.host.invite(botId)).toBeNull();
    expect(rig.host.invite('nobody')).toBeNull();
  });

  it('treats the old token as a new player once the invite was used', () => {
    const { rig, anna } = threePlayerGame();
    const annaId = anna.connection.playerId() ?? '';
    const oldToken = anna.tokens[0];
    rig.net.drop('A');
    settle(rig);
    const code = rig.host.invite(annaId) ?? '';
    joinClient(rig, 'A2', 'Anna', undefined, code);
    settle(rig);

    const stale = joinClient(rig, 'A3', 'Anna', oldToken);
    settle(rig);
    const newId = stale.connection.playerId();
    expect(newId).not.toBeNull();
    expect(newId).not.toBe(annaId);
    expect(rig.host.getState().pending.map((p) => p.id)).toContain(newId);
  });

  it('keeps unused codes in the host snapshot, and a new host accepts them', () => {
    const { rig, anna } = threePlayerGame();
    rig.net.drop('A');
    settle(rig);
    const code = rig.host.invite(anna.connection.playerId() ?? '') ?? '';
    const snapshot = rig.host.snapshot();
    expect(Object.keys(snapshot.invites ?? {})).toContain(code);

    rig.host.stop();
    createHost({
      transport: rig.net.transportFor('H'),
      table: snapshot.table,
      tokens: snapshot.tokens,
      invites: snapshot.invites ?? {},
      now: () => 1000,
      randomSeed: () => 7,
    });
    const back = joinClient(rig, 'A2', 'Anna', undefined, code);
    settle(rig);
    expect(back.connection.playerId()).toBe(anna.connection.playerId());
  });

  it('shows no invite code to the other players', () => {
    const { rig, anna, ben } = threePlayerGame();
    rig.net.drop('A');
    settle(rig);
    const code = rig.host.invite(anna.connection.playerId() ?? '') ?? '';
    settle(rig);
    const bare = code.replace(/(.{4})(.{4})/, '$1-$2');
    for (const event of ben.events) {
      expect(JSON.stringify(event)).not.toContain(code);
      expect(JSON.stringify(event)).not.toContain(bare);
    }
  });
});

describe('replace-player over the network', () => {
  it('kicks the replaced player and seats the waiting one with its own cards only', () => {
    const { rig, ben } = threePlayerGame();
    const benId = ben.connection.playerId() ?? '';
    const carl = joinClient(rig, 'C', 'Carl');
    settle(rig);
    const carlId = carl.connection.playerId() ?? '';
    expect(rig.host.getState().pending.map((p) => p.id)).toContain(carlId);

    rig.host.connection.send({ type: 'replace-player', playerId: benId, by: { kind: 'pending', playerId: carlId } });
    settle(rig);

    expect(statusOf(ben.events)).toBe('kicked');
    const state = rig.host.getState();
    const role = ROLES.find((r) => state.game?.roles[r] === carlId);
    expect(role).toBeDefined();
    const carlView = lastView(carl.events);
    expect(carlView?.you.role).toBe(role);
    const ownHand = role === undefined ? [] : [...(state.game?.engine.initialHands[role] ?? [])];
    for (const card of cardsIn(JSON.stringify(carlView))) {
      expect(ownHand).toContain(card);
    }
  });
});
