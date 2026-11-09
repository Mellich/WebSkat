import { describe, expect, it } from 'vitest';
import { newGame, type CardId, type GameState, type Role, type Trick } from '../../engine';
import { botViewOf } from './knowledge';
import { ramschCard } from './ramsch';

/** A Ramsch in the play phase with the given hands, current trick and the role on turn. */
function ramschState(
  hands: Readonly<Record<Role, readonly CardId[]>>,
  trick: Trick,
  turn: Role,
): GameState {
  return {
    ...newGame(1, { ramschOnPassIn: true }),
    phase: 'playing',
    ramsch: true,
    hands,
    trick,
    turn,
  };
}

describe('ramschCard', () => {
  it('plays the only playable card', () => {
    const state = ramschState(
      { forehand: ['SA'], middlehand: ['H7'], hindhand: ['D8'] },
      { leader: 'forehand', plays: [] },
      'forehand',
    );
    expect(ramschCard(botViewOf(state, 'forehand'))).toBe('SA');
  });

  it('leads the card with the fewest card points', () => {
    const state = ramschState(
      { forehand: ['HA', 'H10', 'C7'], middlehand: ['S7'], hindhand: ['D8'] },
      { leader: 'forehand', plays: [] },
      'forehand',
    );
    expect(ramschCard(botViewOf(state, 'forehand'))).toBe('C7');
  });

  it('dumps the highest-point card it cannot win with, under a higher trump', () => {
    const state = ramschState(
      { forehand: ['HJ'], middlehand: ['C10'], hindhand: ['SA', 'S7', 'D8'] },
      { leader: 'forehand', plays: [{ role: 'forehand', card: 'HJ' }, { role: 'middlehand', card: 'C10' }] },
      'hindhand',
    );
    expect(ramschCard(botViewOf(state, 'hindhand'))).toBe('SA');
  });

  it('when it must win anyway, plays the card with the fewest points', () => {
    const state = ramschState(
      { forehand: ['SK'], middlehand: ['S9'], hindhand: ['SA', 'S10'] },
      { leader: 'forehand', plays: [{ role: 'forehand', card: 'SK' }, { role: 'middlehand', card: 'S9' }] },
      'hindhand',
    );
    expect(ramschCard(botViewOf(state, 'hindhand'))).toBe('S10');
  });

  it('is used by the Normal heuristic for every Ramsch card (botViewOf sets ramsch)', () => {
    const state = ramschState(
      { forehand: ['HA', 'H10', 'C7'], middlehand: ['S7'], hindhand: ['D8'] },
      { leader: 'forehand', plays: [] },
      'forehand',
    );
    expect(botViewOf(state, 'forehand').ramsch).toBe(true);
  });
});
