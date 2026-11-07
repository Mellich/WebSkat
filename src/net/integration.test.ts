// Integration: three participants (host + two clients) play a complete game over the fake
// network, using only the views they receive (docs/09-testing.md §4).

import { describe, expect, it } from 'vitest';
import { ROLES, type CardId } from '../engine';
import type { TableCommand, TableView } from '../table';
import type { GameConnection, ConnectionEvent } from './connection';
import { createRig, joinClient, lastView, settle, type Rig } from './testing';

const CARD = /\b[CSHD](?:7|8|9|10|J|Q|K|A)\b/g;

/** The next action of the player whose view offers one; null when nothing is offered. */
function choose(view: TableView | null): TableCommand | null {
  const g = view?.game;
  if (g === null || g === undefined || g.phase === 'finished') return null;
  const legal = g.legal;
  if (legal.canClaim === true) return { type: 'game', action: { type: 'claim' } };
  if (legal.bidValues?.includes(18) === true && g.bidding.currentBid === null) {
    return { type: 'game', action: { type: 'bid', value: 18 } };
  }
  if (legal.canPassBid === true) return { type: 'game', action: { type: 'pass' } };
  if (legal.canPickUp === true) return { type: 'game', action: { type: 'pickup-skat' } };
  const discard = legal.discardFrom;
  if (discard !== undefined && discard.length >= 2) {
    const [a, b] = discard;
    if (a !== undefined && b !== undefined) return { type: 'game', action: { type: 'discard', cards: [a, b] } };
  }
  const declaration = legal.declarations?.[0];
  if (declaration !== undefined) return { type: 'game', action: { type: 'declare', declaration } };
  const card = legal.playableCards?.[0];
  if (card !== undefined) return { type: 'game', action: { type: 'play', card } };
  return null;
}

function cardsIn(json: string): CardId[] {
  return (json.match(CARD) ?? []) as CardId[];
}

describe('a complete game over the network', () => {
  it('is played to the end by three players who only use their own views', () => {
    const rig: Rig = createRig();
    const anna = joinClient(rig, 'A', 'Anna');
    const ben = joinClient(rig, 'B', 'Ben');
    settle(rig);
    const players: { connection: GameConnection; events: ConnectionEvent[] }[] = [
      { connection: rig.host.connection, events: [] },
      anna,
      ben,
    ];
    rig.host.connection.subscribe((e) => {
      players[0]?.events.push(e);
    });

    rig.host.connection.send({ type: 'start' });
    settle(rig);

    const state = rig.host.getState();
    const ownHands = (id: string): CardId[] => {
      const role = ROLES.find((r) => state.game?.roles[r] === id);
      return role === undefined ? [] : [...(state.game?.engine.initialHands[role] ?? [])];
    };
    for (const p of players.slice(1)) {
      const view = lastView(p.events);
      const id = p.connection.playerId() ?? '';
      const shown = cardsIn(JSON.stringify(view));
      for (const card of shown) {
        expect(ownHands(id)).toContain(card);
      }
    }

    for (let round = 0; round < 400 && rig.host.getState().game?.engine.phase !== 'finished'; round++) {
      for (const p of players) {
        const command = choose(lastView(p.events));
        if (command !== null) p.connection.send(command);
      }
      settle(rig);
    }
    expect(rig.host.getState().game?.engine.phase).toBe('finished');

    for (const p of players) {
      p.connection.send({ type: 'ready' });
    }
    settle(rig);

    const records = rig.host.getState().records;
    expect(records).toHaveLength(1);
    expect(rig.host.getState().gameCounter).toBe(2);
    for (const p of players.slice(1)) {
      const received = p.events.filter((e) => e.t === 'record');
      expect(received).toHaveLength(1);
    }
    const latestHistory = players[0]?.events.filter((e) => e.t === 'records').at(-1);
    expect(latestHistory).toEqual({ t: 'records', records: records });
  });
});

