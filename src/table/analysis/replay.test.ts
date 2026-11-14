import { describe, expect, it } from 'vitest';
import { cardPoints, getLegal, type CardId, type GameState } from '../../engine';
import type { TableState } from '../types';
import { viewFor } from '../view';
import { analysisInputFromView } from './fromView';
import {
  actualLine,
  analysisStart,
  chooseCard,
  divergenceAt,
  positionAt,
  validateInput,
} from './replay';
import { finishedTable } from './testing';
import type { AnalysisInput } from './types';

function inputOf(s: TableState): AnalysisInput {
  const input = analysisInputFromView(viewFor(s, 'p0'));
  if (input === null) throw new Error('expected an input');
  return input;
}

function startOf(input: AnalysisInput): GameState {
  const start = analysisStart(input);
  if (!start.ok || start.value === null) throw new Error('expected a start state');
  return start.value;
}

describe('played game replay', () => {
  const s = finishedTable('played');
  const input = inputOf(s);

  it('validates and replays the actual play to the engine result', () => {
    expect(validateInput(input)).toEqual({ ok: true, value: null });
    const end = positionAt(startOf(input), input.plays);
    if (!end.ok) throw new Error(end.error.message);
    expect(end.value.mover).toBeNull();
    expect(end.value.playable).toEqual([]);
    expect(end.value.result).toEqual(s.game?.engine.result);
  });

  it('starts with forehand to play and offers exactly the legal cards of forehand', () => {
    const start = startOf(input);
    const pos = positionAt(start, []);
    if (!pos.ok) throw new Error(pos.error.message);
    expect(pos.value.mover).toBe('forehand');
    expect(pos.value.playable).toEqual(getLegal(start, 'forehand').playableCards);
    expect(pos.value.hands.forehand).toHaveLength(10);
    expect(pos.value.points).toEqual({ forehand: 0, middlehand: 0, hindhand: 0 });
    expect(pos.value.tricksWon).toEqual({ forehand: 0, middlehand: 0, hindhand: 0 });
    expect(pos.value.lastTrick).toBeNull();
  });

  it('counts the card points of the completed trick for its winner', () => {
    const three = positionAt(startOf(input), input.plays.slice(0, 3));
    if (!three.ok) throw new Error(three.error.message);
    const winner = three.value.tricks[0]?.winner;
    const trickPoints = input.plays.slice(0, 3).reduce((sum, c) => sum + cardPoints(c), 0);
    expect(winner).toBeDefined();
    if (winner === undefined) return;
    expect(three.value.points[winner]).toBe(trickPoints);
    expect(three.value.tricksWon[winner]).toBe(1);
  });

  it('rejects a card of another hand', () => {
    const start = startOf(input);
    const foreign = start.hands.middlehand[0];
    if (foreign === undefined) throw new Error('no card');
    const result = positionAt(start, [foreign]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(['ILLEGAL_CARD', 'NOT_YOUR_TURN']).toContain(result.error.code);
  });

  it('chooseCard follows the actual line without a variant', () => {
    const first = input.plays[0];
    if (first === undefined) throw new Error('no play');
    const next = chooseCard(actualLine(input), first);
    expect(next).toEqual({ plays: input.plays, cursor: 1 });
    expect(divergenceAt(input.plays, next)).toBeNull();
  });

  it('chooseCard with another card cuts the rest and starts a variant', () => {
    const pos = positionAt(startOf(input), []);
    if (!pos.ok) throw new Error(pos.error.message);
    const other = pos.value.playable.find((c) => c !== input.plays[0]);
    if (other === undefined) throw new Error('only one playable card');
    const line = chooseCard(actualLine(input), other);
    expect(line).toEqual({ plays: [other], cursor: 1 });
    expect(divergenceAt(input.plays, line)).toBe(0);
  });

  it('divergenceAt returns the index where a line leaves the actual game', () => {
    const actual = input.plays;
    const other = actual[5];
    if (other === undefined) throw new Error('short game');
    expect(divergenceAt(actual, { plays: actual.slice(0, 5), cursor: 5 })).toBeNull();
    const changed: CardId[] = [...actual.slice(0, 4), other];
    expect(divergenceAt(actual, { plays: changed, cursor: changed.length })).toBe(4);
  });
});

describe('Ramsch replay', () => {
  it('replays a Ramsch to the same result', () => {
    const s = finishedTable('ramsch');
    const input = inputOf(s);
    expect(input.declarer).toBeNull();
    expect(validateInput(input)).toEqual({ ok: true, value: null });
    const end = positionAt(startOf(input), input.plays);
    if (!end.ok) throw new Error(end.error.message);
    expect(end.value.result).toEqual(s.game?.engine.result);
  });
});

describe('passed-in game', () => {
  const input = inputOf(finishedTable('passed-in'));

  it('has no start state and is valid only without plays', () => {
    expect(analysisStart(input)).toEqual({ ok: true, value: null });
    expect(validateInput(input)).toEqual({ ok: true, value: null });
    expect(validateInput({ ...input, plays: ['C7'] }).ok).toBe(false);
  });
});
