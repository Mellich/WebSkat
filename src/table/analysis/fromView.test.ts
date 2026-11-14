import { describe, expect, it } from 'vitest';
import { ALL_CARDS, type CardId } from '../../engine';
import { tableWith } from '../testing';
import { viewFor } from '../view';
import { analysisInputFromView } from './fromView';
import { finishedTable, startedTable } from './testing';

const ROLES = ['forehand', 'middlehand', 'hindhand'] as const;

describe('analysisInputFromView', () => {
  it('is null while the game runs', () => {
    const running = startedTable('played', 1);
    expect(viewFor(running, 'p0').game?.phase).toBe('bidding');
    expect(analysisInputFromView(viewFor(running, 'p0'))).toBeNull();
  });

  it('is null without a game', () => {
    expect(analysisInputFromView(viewFor(tableWith(3), 'p0'))).toBeNull();
  });

  it('describes a finished played game: names, dealt hands, Skat and the actual play', () => {
    const s = finishedTable('played');
    const view = viewFor(s, 'p2');
    const input = analysisInputFromView(view);
    if (input === null || view.game === null) throw new Error('expected an input');

    expect(input.version).toBe(1);
    expect(input.kind).toBe('played');
    const nameOf = (id: string): string => s.players.find((p) => p.id === id)?.name ?? '?';
    expect(input.names).toEqual({
      forehand: nameOf(view.game.roles.forehand),
      middlehand: nameOf(view.game.roles.middlehand),
      hindhand: nameOf(view.game.roles.hindhand),
    });
    for (const role of ROLES) {
      expect(input.hands[role]).toHaveLength(10);
      expect(input.hands[role]).toEqual(view.game.initialHands?.[view.game.roles[role]]);
    }
    expect(input.skat).toHaveLength(2);
    const all: CardId[] = [...ROLES.flatMap((r) => [...input.hands[r]]), ...input.skat];
    expect([...all].sort()).toEqual([...ALL_CARDS].sort());
    expect(input.declarer).not.toBeNull();
    expect(input.declaration).not.toBeNull();
    expect(input.bid).not.toBeNull();
    expect(input.plays).toHaveLength(3 * (view.game.tricks?.length ?? -1));
  });

  it('describes a passed-in game: no declarer, no play, the Skat is the two cards left over', () => {
    const input = analysisInputFromView(viewFor(finishedTable('passed-in'), 'stranger'));
    if (input === null) throw new Error('expected an input');
    expect(input.kind).toBe('passed-in');
    expect(input.declarer).toBeNull();
    expect(input.declaration).toBeNull();
    expect(input.bid).toBeNull();
    expect(input.plays).toEqual([]);
    expect(input.skat).toHaveLength(2);
    const all = [...ROLES.flatMap((r) => [...input.hands[r]]), ...input.skat];
    expect([...all].sort()).toEqual([...ALL_CARDS].sort());
  });

  it('describes a Ramsch: kind ramsch, no declarer, no discard, all 30 plays', () => {
    const input = analysisInputFromView(viewFor(finishedTable('ramsch'), 'p0'));
    if (input === null) throw new Error('expected an input');
    expect(input.kind).toBe('ramsch');
    expect(input.declarer).toBeNull();
    expect(input.discarded).toEqual([]);
    expect(input.plays).toHaveLength(30);
  });

  it('is JSON serializable without changes', () => {
    const input = analysisInputFromView(viewFor(finishedTable('played'), 'p1'));
    expect(input).not.toBeNull();
    expect(JSON.parse(JSON.stringify(input))).toEqual(input);
  });
});
