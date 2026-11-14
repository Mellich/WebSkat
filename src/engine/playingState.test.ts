import { describe, expect, it } from 'vitest';
import { applyAction, enumerateActions, isFinished, newGame } from './game';
import { playingStateFrom, type PlaySetup } from './playingState';
import { mulberry32 } from './rng';
import { hand } from './testing';
import type { GameState } from './types';

/** Setup of a finished game: everything the analysis knows (no seed, no bidding). */
function setupOf(state: GameState): PlaySetup {
  return {
    hands: state.initialHands,
    skat: state.skat,
    ramsch: state.ramsch,
    declarer: state.declarer,
    declaration: state.declaration,
    bid: state.bid,
    pickedUpSkat: state.pickedUpSkat,
    discarded: state.discarded,
    doubling: state.doubling,
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error('cannot pick from an empty list');
  }
  return item;
}

/** Plays a random legal game to the end (same pattern as game.fuzz.test.ts). */
function randomFinished(seed: number): GameState {
  const random = mulberry32(seed * 104729 + 3);
  let state = newGame(seed, { ramschOnPassIn: seed % 3 === 0, kontra: seed % 2 === 0 });
  for (let step = 0; !isFinished(state) && step < 300; step++) {
    const turn = state.turn;
    if (turn === null) {
      throw new Error(`seed ${String(seed)}: nobody on turn`);
    }
    const next = applyAction(state, turn, pick(enumerateActions(state, turn), random));
    if (!next.ok) {
      throw new Error(`seed ${String(seed)}: enumerated action rejected`);
    }
    state = next.value;
  }
  return state;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

/** A valid Hand-less, Skat-picked-up suit game: middlehand declares Hearts with discard S9 S10. */
const BASE: PlaySetup = {
  hands: {
    forehand: hand('C7 C8 C9 C10 CJ CQ CK CA S7 S8'),
    middlehand: hand('H7 H8 H9 H10 HJ HQ HK HA S9 S10'),
    hindhand: hand('D7 D8 D9 D10 DJ DQ DK DA SJ SQ'),
  },
  skat: hand('SK SA'),
  ramsch: false,
  declarer: 'middlehand',
  declaration: { kind: 'suit', trump: 'H', hand: false, announce: 'none', ouvert: false },
  bid: 18,
  pickedUpSkat: true,
  discarded: hand('S9 S10'),
  doubling: 1,
};

const HAND_DECLARATION = { kind: 'suit', trump: 'H', hand: true, announce: 'none', ouvert: false } as const;

function codeOf(setup: PlaySetup): string | null {
  const result = playingStateFrom(setup);
  return result.ok ? null : result.error.code;
}

describe('playingStateFrom', () => {
  it('replays every card of random finished games to the same result (300 seeds)', () => {
    let played = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const finished = randomFinished(seed);
      if (finished.result?.kind === 'passed-in') {
        continue;
      }
      played++;
      const start = playingStateFrom(setupOf(finished));
      if (!start.ok) {
        throw new Error(`seed ${String(seed)}: ${start.error.code} ${start.error.message}`);
      }
      let state = start.value;
      for (const trick of finished.tricks) {
        for (const play of trick.plays) {
          const next = applyAction(state, play.role, { type: 'play', card: play.card });
          if (!next.ok) {
            throw new Error(`seed ${String(seed)}: ${play.card} rejected: ${next.error.code}`);
          }
          state = next.value;
        }
      }
      expect(state.phase).toBe('finished');
      expect(state.result).toEqual(finished.result);
    }
    expect(played).toBeGreaterThan(100);
  });

  it('starts a Hand game with the declarer keeping 10 cards and no discard', () => {
    const result = playingStateFrom({
      ...BASE,
      pickedUpSkat: false,
      discarded: [],
      declaration: HAND_DECLARATION,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hands.middlehand).toHaveLength(10);
      expect(result.value.discarded).toEqual([]);
      expect(result.value.pickedUpSkat).toBe(false);
      expect(result.value.phase).toBe('playing');
      expect(result.value.turn).toBe('forehand');
    }
  });

  it('gives the declarer the Skat and removes the discard', () => {
    const result = playingStateFrom(BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const cards = result.value.hands.middlehand;
      expect(cards).toHaveLength(10);
      expect(cards).toContain('SK');
      expect(cards).toContain('SA');
      expect(cards).not.toContain('S9');
      expect(cards).not.toContain('S10');
    }
  });

  it('builds a Ramsch with no declarer, declaration or bid, starting with forehand', () => {
    let ramsch: GameState | undefined;
    for (let seed = 3; seed <= 300 && ramsch === undefined; seed += 3) {
      const candidate = randomFinished(seed);
      if (candidate.ramsch) {
        ramsch = candidate;
      }
    }
    if (ramsch === undefined) {
      throw new Error('expected a Ramsch in the sample');
    }
    const result = playingStateFrom(setupOf(ramsch));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ramsch).toBe(true);
      expect(result.value.declarer).toBeNull();
      expect(result.value.declaration).toBeNull();
      expect(result.value.bid).toBeNull();
      expect(result.value.turn).toBe('forehand');
    }
  });

  it('accepts the base setup', () => {
    expect(codeOf(BASE)).toBeNull();
  });

  it('rejects a duplicate card as UNKNOWN_CARD', () => {
    expect(codeOf({ ...BASE, skat: hand('SK C7') })).toBe('UNKNOWN_CARD');
  });

  it('rejects a hand with 9 cards as UNKNOWN_CARD', () => {
    expect(codeOf({ ...BASE, hands: { ...BASE.hands, forehand: hand('C7 C8 C9 C10 CJ CQ CK CA S7') } })).toBe(
      'UNKNOWN_CARD',
    );
  });

  it('rejects a Ramsch with a declarer as INVALID_DECLARATION', () => {
    expect(codeOf({ ...BASE, ramsch: true, pickedUpSkat: false, discarded: [] })).toBe('INVALID_DECLARATION');
  });

  it('rejects a discard of a card that is neither in hand nor in the Skat as INVALID_DISCARD', () => {
    expect(codeOf({ ...BASE, discarded: hand('S9 D7') })).toBe('INVALID_DISCARD');
  });

  it('rejects a discard when the Skat was not picked up as INVALID_DISCARD', () => {
    expect(codeOf({ ...BASE, pickedUpSkat: false, declaration: HAND_DECLARATION })).toBe('INVALID_DISCARD');
  });

  it('rejects a Hand declaration when the Skat was picked up as INVALID_DECLARATION', () => {
    expect(codeOf({ ...BASE, declaration: HAND_DECLARATION })).toBe('INVALID_DECLARATION');
  });

  it('does not mutate the setup', () => {
    const setup = deepFreeze({ ...BASE, hands: { ...BASE.hands }, discarded: [...BASE.discarded] });
    const before = JSON.stringify(setup);
    expect(playingStateFrom(setup).ok).toBe(true);
    expect(JSON.stringify(setup)).toBe(before);
  });

  it('keeps the dealt hands as initialHands', () => {
    const result = playingStateFrom(BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.initialHands).toEqual(BASE.hands);
      expect(result.value.skat).toEqual(hand('SK SA'));
    }
  });
});
