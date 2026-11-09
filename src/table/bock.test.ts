import { describe, expect, it } from 'vitest';
import type { GameResult } from '../engine';
import { BOCK_GAMES, nextBockGamesLeft, triggersBock } from './bock';
import { DIAMONDS_LOST, GRAND_144, NULL_OUVERT_WON } from './fixtures';
import { playUntilRecords, ctxFor, tableWith } from './testing';
import { applyCommand, createTable, dealNext } from './table';
import type { Ctx, TableRules, TableState } from './types';

/** A played result with `declarerPoints` 60 : 60 (declarer lost, skat-rules §13). */
type PlayedResult = Extract<GameResult, { kind: 'played' }>;
function played(result: GameResult): PlayedResult {
  if (result.kind !== 'played') throw new Error('fixture is not a played game');
  return result;
}
const SIXTY_SIXTY: PlayedResult = { ...played(DIAMONDS_LOST), declarerPoints: 60, defenderPoints: 60 };

describe('triggersBock', () => {
  it('is true for a suit game ending 60 : 60', () => {
    expect(triggersBock(SIXTY_SIXTY)).toBe(true);
  });

  it('is true for a Grand game ending 60 : 60', () => {
    const grand: PlayedResult = { ...played(GRAND_144), won: false, declarerPoints: 60, defenderPoints: 60 };
    expect(triggersBock(grand)).toBe(true);
  });

  it('is false for 61 : 59 and 59 : 61', () => {
    expect(triggersBock({ ...SIXTY_SIXTY, declarerPoints: 61, defenderPoints: 59 })).toBe(false);
    expect(triggersBock({ ...SIXTY_SIXTY, declarerPoints: 59, defenderPoints: 61 })).toBe(false);
  });

  it('is false for Null games, Ramsch and passed-in games', () => {
    expect(triggersBock(NULL_OUVERT_WON)).toBe(false);
    expect(triggersBock({ kind: 'passed-in' })).toBe(false);
    expect(
      triggersBock({
        kind: 'ramsch',
        points: { forehand: 60, middlehand: 60, hindhand: 0 },
        tricks: { forehand: 5, middlehand: 5, hindhand: 0 },
        skatTo: 'forehand',
        losers: [],
        jungfrau: false,
        durchmarsch: null,
        scores: { forehand: 0, middlehand: 0, hindhand: 0 },
      }),
    ).toBe(false);
  });
});

describe('nextBockGamesLeft (skat-rules §13 B4–B7)', () => {
  it('starts 3 Bock games on a trigger outside a Bock game (B4)', () => {
    expect(nextBockGamesLeft(0, false, true)).toBe(3);
    expect(BOCK_GAMES).toBe(3);
  });

  it('counts down a Bock game without trigger (B5)', () => {
    expect(nextBockGamesLeft(3, true, false)).toBe(2);
  });

  it('adds 3 more when a Bock game triggers (B6)', () => {
    expect(nextBockGamesLeft(2, true, true)).toBe(4);
  });

  it('counts down a passed-in Bock game (B7)', () => {
    expect(nextBockGamesLeft(1, true, false)).toBe(0);
  });

  it('keeps 0 for an ordinary game without trigger', () => {
    expect(nextBockGamesLeft(0, false, false)).toBe(0);
  });
});

describe('table flow with Bockrunden', () => {
  const ON: TableRules = { ramsch: false, bock: true };

  function withRules(s: TableState, rules: TableRules): TableState {
    const result = applyCommand(s, 'p0', { type: 'set-rules', rules }, ctxFor(1));
    if (!result.ok) throw new Error(result.error.message);
    return result.value.state;
  }

  it('starts with the rule off and no Bock games left', () => {
    const s = tableWith(3);
    expect(s.rules.bock).toBe(false);
    expect(s.bockGamesLeft).toBe(0);
    expect(createTable({ key: 'K', name: 'n', isPublic: false, hostId: 'p0', hostName: 'h' }).bockGamesLeft).toBe(0);
  });

  it('turning the rule off clears the remaining Bock games', () => {
    let s = withRules(tableWith(3), ON);
    s = { ...s, bockGamesLeft: 2 };
    s = withRules(s, { ramsch: false, bock: false });
    expect(s.bockGamesLeft).toBe(0);
  });

  it('deals a Bock game only while Bock games are left', () => {
    const s = withRules(tableWith(3), ON);
    expect(dealNext(s, ctxFor(5)).game?.bock).toBe(false);
    expect(dealNext({ ...s, bockGamesLeft: 2 }, ctxFor(5)).game?.bock).toBe(true);
  });

  it('never marks a game as Bock when the rule is off', () => {
    const s = { ...tableWith(3), bockGamesLeft: 2 };
    expect(dealNext(s, ctxFor(5)).game?.bock).toBe(false);
  });

  it('keeps every record consistent with the counter over several random games', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = withRules(tableWith(3), ON);
      s = dealNext(s, ctxFor(seed));
      let rng = seed;
      const rand = (): number => {
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        return rng / 0x80000000;
      };
      const ctxOf = (): Ctx => ctxFor(seed);
      s = playUntilRecords(s, 8, ctxOf, rand);
      // The counter changes only at record time: replay the records against the rule.
      let left = 0;
      for (const record of s.records) {
        expect(record.bock).toBe(left > 0);
        left = nextBockGamesLeft(left, record.bock, record.bockTriggered);
      }
      expect(s.bockGamesLeft).toBe(left);
    }
  });
});
