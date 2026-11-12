import { describe, expect, it } from 'vitest';
import { finishedGameFixture, tableViewFixture } from './viewFixtures';
import { revealedHands } from './revealedHands';

describe('revealedHands', () => {
  it('is null while no game is shown or the game is still running', () => {
    expect(revealedHands(tableViewFixture(null))).toBeNull();
    expect(revealedHands(tableViewFixture(finishedGameFixture({ initialHands: null })))).toBeNull();
  });

  it('lists every dealt hand in seat-role order with the player names', () => {
    const game = finishedGameFixture({
      initialHands: { a: ['C7', 'S8'], b: ['H9'], c: ['D10'] },
      skat: ['CA', 'SK'],
    });
    expect(revealedHands(tableViewFixture(game))).toEqual({
      players: [
        { name: 'Anna', cards: ['C7', 'S8'] },
        { name: 'Ben', cards: ['H9'] },
        { name: 'Cem', cards: ['D10'] },
      ],
      skat: ['CA', 'SK'],
    });
  });

  it('gives no Skat when the game has none (passed-in game)', () => {
    const game = finishedGameFixture({ initialHands: { a: [], b: [], c: [] }, skat: null });
    expect(revealedHands(tableViewFixture(game))?.skat).toBeNull();
  });
});
