import { describe, expect, it } from 'vitest';
import { nextRole, playCard } from './play';
import { hand, snapshot, stateWith } from './testing';
import type { GameState, Role } from './types';

const SUIT_HEARTS = { kind: 'suit', trump: 'H', hand: false, announce: 'none', ouvert: false } as const;
const NULL_GAME = { kind: 'null', hand: false, ouvert: false } as const;

function playingState(overrides: Partial<GameState>): GameState {
  return stateWith({
    phase: 'playing',
    turn: 'forehand',
    declarer: 'forehand',
    bid: 18,
    pickedUpSkat: false,
    declaration: SUIT_HEARTS,
    ...overrides,
  });
}

describe('nextRole', () => {
  it.each([
    ['forehand', 'middlehand'],
    ['middlehand', 'hindhand'],
    ['hindhand', 'forehand'],
  ] as const)('%s → %s (clockwise)', (from, to) => {
    expect(nextRole(from)).toBe(to);
  });
});

describe('playCard errors', () => {
  it('rejects cards outside the playing phase', () => {
    const result = playCard(stateWith({ phase: 'bidding' }), 'middlehand', 'CA');
    expect(result).toMatchObject({ ok: false, error: { code: 'WRONG_PHASE' } });
  });

  it('rejects a player who is not on turn', () => {
    const state = playingState({ hands: { forehand: hand('CA'), middlehand: hand('C7'), hindhand: hand('C8') } });
    const result = playCard(state, 'middlehand', 'C7');
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_YOUR_TURN' } });
  });

  it('rejects a card that is not in the hand', () => {
    const state = playingState({ hands: { forehand: hand('CA'), middlehand: hand('C7'), hindhand: hand('C8') } });
    expect(playCard(state, 'forehand', 'SA')).toMatchObject({ ok: false, error: { code: 'ILLEGAL_CARD' } });
  });

  it('enforces following suit', () => {
    const state = playingState({
      declaration: SUIT_HEARTS,
      trick: { leader: 'forehand', plays: [{ role: 'forehand', card: 'CA' }] },
      turn: 'middlehand',
      hands: { forehand: [], middlehand: hand('S7 C9'), hindhand: [] },
    });
    expect(playCard(state, 'middlehand', 'S7')).toMatchObject({ ok: false, error: { code: 'ILLEGAL_CARD' } });
    expect(playCard(state, 'middlehand', 'C9').ok).toBe(true);
  });

  it('does not mutate the input state', () => {
    const state = playingState({
      declaration: SUIT_HEARTS,
      hands: { forehand: hand('CA C7'), middlehand: hand('C8'), hindhand: hand('C9') },
    });
    const before = snapshot(state);
    playCard(state, 'forehand', 'CA');
    expect(state).toEqual(before);
  });
});

describe('trick progression', () => {
  it('moves the turn clockwise after an incomplete trick', () => {
    const state = playingState({
      declaration: SUIT_HEARTS,
      hands: { forehand: hand('CA C7'), middlehand: hand('C8'), hindhand: hand('C9') },
    });
    const result = playCard(state, 'forehand', 'CA');
    expect(result).toMatchObject({
      ok: true,
      value: {
        turn: 'middlehand',
        trick: { leader: 'forehand', plays: [{ role: 'forehand', card: 'CA' }] },
        hands: { forehand: ['C7'] },
      },
    });
  });

  it('gives the trick to the winner, who leads the next trick', () => {
    const state = playingState({
      declaration: SUIT_HEARTS,
      trick: {
        leader: 'forehand',
        plays: [
          { role: 'forehand', card: 'CA' },
          { role: 'middlehand', card: 'C7' },
        ],
      },
      turn: 'hindhand',
      hands: { forehand: hand('D7 D8'), middlehand: hand('D9 D10'), hindhand: hand('C8 D9') },
    });
    const result = playCard(state, 'hindhand', 'C8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tricks).toEqual([
      {
        leader: 'forehand',
        plays: [
          { role: 'forehand', card: 'CA' },
          { role: 'middlehand', card: 'C7' },
          { role: 'hindhand', card: 'C8' },
        ],
        winner: 'forehand',
      },
    ]);
    expect(result.value.trick).toEqual({ leader: 'forehand', plays: [] });
    expect(result.value.turn).toBe('forehand');
    expect(result.value.phase).toBe('playing');
  });

  it('lets a trump beat a higher card of the led suit', () => {
    const state = playingState({
      declaration: SUIT_HEARTS,
      trick: {
        leader: 'forehand',
        plays: [
          { role: 'forehand', card: 'CA' },
          { role: 'middlehand', card: 'C10' },
        ],
      },
      turn: 'hindhand',
      hands: { forehand: [], middlehand: [], hindhand: hand('SJ S7') },
    });
    const result = playCard(state, 'hindhand', 'SJ');
    expect(result.ok && result.value.tricks[0]?.winner).toBe('hindhand');
  });
});

describe('Null early end', () => {
  const nullState = (declarer: Role, plays: GameState['trick']['plays'], turn: Role): GameState =>
    playingState({
      declaration: NULL_GAME,
      declarer,
      bid: 23,
      skat: hand('D9 D10'),
      initialHands: {
        forehand: hand('C7 S7'),
        middlehand: hand('C9 S9'),
        hindhand: hand('CA SA'),
      },
      hands: { forehand: hand('C7 S7'), middlehand: hand('C9 S9'), hindhand: hand('CA SA') },
      trick: { leader: 'forehand', plays },
      turn,
    });

  it('ends the game as soon as the declarer wins a trick', () => {
    const state = nullState(
      'hindhand',
      [
        { role: 'forehand', card: 'C7' },
        { role: 'middlehand', card: 'C9' },
      ],
      'hindhand',
    );
    const result = playCard(state, 'hindhand', 'CA');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe('finished');
    expect(result.value.turn).toBeNull();
    expect(result.value.tricks).toHaveLength(1);
    expect(result.value.result).toMatchObject({
      kind: 'played',
      declarerTricks: 1,
      won: false,
      gameValue: 23,
      declarerScore: -46,
    });
  });

  it('continues when a defender wins the trick', () => {
    const state = playingState({
      declaration: NULL_GAME,
      declarer: 'middlehand',
      bid: 23,
      trick: {
        leader: 'forehand',
        plays: [
          { role: 'forehand', card: 'CA' },
          { role: 'middlehand', card: 'C9' },
        ],
      },
      turn: 'hindhand',
      hands: { forehand: hand('S7'), middlehand: hand('S9'), hindhand: hand('C8 SA') },
    });
    const result = playCard(state, 'hindhand', 'C8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe('playing');
    expect(result.value.tricks[0]?.winner).toBe('forehand');
    expect(result.value.turn).toBe('forehand');
  });
});
