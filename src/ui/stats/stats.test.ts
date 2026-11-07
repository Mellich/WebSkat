import { describe, expect, it } from 'vitest';
import type { GameRecord, TableStats } from '../../table';
import { translate } from '../i18n';
import { chartPlots } from './chartGeometry';
import { gameLabel, signed } from './gameLabel';

const en = (key: Parameters<typeof translate>[1]) => translate('en', key);

const SERIES: TableStats['series'] = [
  { gameNumber: 1, cumulative: { a: { standard: 144, seeger: 194 }, b: { standard: 0, seeger: 0 } } },
  { gameNumber: 2, cumulative: { a: { standard: 90, seeger: 90 }, b: { standard: 0, seeger: 40 } } },
];

describe('chartPlots', () => {
  const box = { width: 100, height: 100, margin: 10 };

  it('places one point per game for every player, left to right', () => {
    const { plots } = chartPlots(SERIES, ['a', 'b'], 'seeger', box);
    expect(plots).toHaveLength(2);
    expect(plots[0]?.points.map((p) => p.x)).toEqual([10, 90]);
  });

  it('scales the value range to the box and keeps zero in range', () => {
    const { min, max, plots } = chartPlots(SERIES, ['a', 'b'], 'seeger', box);
    expect(min).toBe(0);
    expect(max).toBe(194);
    expect(plots[0]?.points[0]?.y).toBe(10);
    expect(plots[1]?.points[0]?.y).toBe(90);
  });

  it('uses the scoring system that was asked for', () => {
    const { max } = chartPlots(SERIES, ['a'], 'standard', box);
    expect(max).toBe(144);
  });

  it('draws a single game in the middle', () => {
    const { plots } = chartPlots(SERIES.slice(0, 1), ['a'], 'seeger', box);
    expect(plots[0]?.points[0]?.x).toBe(50);
  });
});

describe('gameLabel', () => {
  const base: GameRecord = {
    id: 'K-1',
    number: 1,
    timestamp: 0,
    tableSize: 3,
    dealerId: 'a',
    roles: { forehand: 'a', middlehand: 'b', hindhand: 'c' },
    sittingOut: [],
    names: {},
    outcome: 'played',
    declarerId: 'a',
    bid: 18,
    game: 'hearts',
    hand: false,
    ouvert: false,
    announce: 'none',
    spitzenWith: true,
    spitzenCount: 2,
    multiplier: 3,
    gameValue: 30,
    declarerPoints: 70,
    defenderPoints: 50,
    declarerTricks: 6,
    schneider: false,
    schwarz: false,
    overbid: false,
    won: true,
    scores: { standard: {}, seeger: {} },
  };
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
    translate('en', key, params);

  it('names the game with its options', () => {
    expect(gameLabel(base, t)).toBe('Hearts');
    expect(gameLabel({ ...base, game: 'grand', hand: true, announce: 'schneider', ouvert: true }, t)).toBe(
      'Grand Hand Schneider Ouvert',
    );
  });

  it('says passed in for a game that was not played', () => {
    expect(gameLabel({ ...base, outcome: 'passed-in', game: null }, t)).toBe(en('stats.passedIn'));
  });
});

describe('signed', () => {
  it.each([
    [96, '+96'],
    [-54, '−54'],
    [0, '0'],
  ])('%i → %s', (value, text) => {
    expect(signed(value)).toBe(text);
  });
});
