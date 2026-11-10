import { describe, expect, it } from 'vitest';
import { computeStats, type GameRecord } from '../../table';
import { translate } from '../i18n';
import { csvField, historyCsv } from './csv';

const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate('en', key, params);

const RECORD: GameRecord = {
  id: 'K-1',
  number: 1,
  timestamp: 0,
  tableSize: 3,
  dealerId: 'a',
  roles: { forehand: 'a', middlehand: 'b', hindhand: 'c' },
  sittingOut: [],
  names: { a: 'Ann', b: '=Bob, "B"', c: 'Cy' },
  outcome: 'passed-in',
  bock: false,
  bockTriggered: false,
  doubling: 1,
  declarerId: null,
  bid: null,
  game: null,
  hand: false,
  ouvert: false,
  announce: 'none',
  spitzenWith: null,
  spitzenCount: null,
  multiplier: null,
  gameValue: null,
  declarerPoints: null,
  defenderPoints: null,
  declarerTricks: null,
  schneider: false,
  schwarz: false,
  overbid: false,
  won: false,
  ramsch: null,
  scores: { standard: { a: 0, b: 0, c: 0 }, seeger: { a: 0, b: 0, c: 0 } },
};

describe('csvField', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });
  it('neutralises formulas', () => {
    expect(csvField('=1+1')).toBe("'=1+1");
  });
});

describe('historyCsv', () => {
  it('writes a header and one row per game with both scoring systems', () => {
    const stats = computeStats([RECORD], []);
    const lines = historyCsv([RECORD], stats.players, t).trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"\'=Bob, ""B"" (Seeger–Fabian)"');
    expect(lines[1]).toContain('Passed in');
    expect(lines[1]?.split(',')).toHaveLength(14);
  });
});
