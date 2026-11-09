import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../../table';
import { translate, type Translator } from '../i18n';
import { logText } from './logText';

const t: Translator = (key, params) => translate('en', key, params);
const meta = { n: 1, at: 0 };
const declaration = { kind: 'suit' as const, trump: 'D' as const, hand: true, announce: 'none' as const, ouvert: false };

function text(entry: LogEntry): string {
  return logText(entry, t);
}

describe('logText (English)', () => {
  it('describes joins, reconnects, disconnects, leaves, kicks and replacements', () => {
    expect(text({ kind: 'joined', playerId: 'p1', name: 'Anna', isBot: false, pending: false, ...meta })).toBe('Anna joined');
    expect(text({ kind: 'joined', playerId: 'p1', name: 'Anna', isBot: false, pending: true, ...meta }))
      .toBe('Anna joined and waits for the next game');
    expect(text({ kind: 'joined', playerId: 'bot-3', name: 'Bot', isBot: true, pending: false, ...meta })).toBe('Bot Bot was added');
    expect(text({ kind: 'reconnected', playerId: 'p1', name: 'Anna', ...meta })).toBe('Anna is back');
    expect(text({ kind: 'disconnected', playerId: 'p1', name: 'Anna', ...meta })).toBe('Anna lost the connection');
    expect(text({ kind: 'left', playerId: 'p1', name: 'Anna', ...meta })).toBe('Anna left the table');
    expect(text({ kind: 'kicked', playerId: 'p1', name: 'Anna', ...meta })).toBe('Anna was removed');
    expect(text({ kind: 'replaced', playerId: 'p1', name: 'Anna', byId: 'bot-3', byName: 'Bot', ...meta }))
      .toBe('Bot took over the seat of Anna');
  });

  it('describes the deal, bids, the skat, the declaration and an abort', () => {
    expect(text({ kind: 'dealt', number: 2, dealerId: 'p0', dealerName: 'Host', bock: false, ...meta })).toBe('Game 2 — dealer: Host');
    expect(text({ kind: 'dealt', number: 3, dealerId: 'p0', dealerName: 'Host', bock: true, ...meta }))
      .toBe('Game 3 (Bock) — dealer: Host');
    expect(text({ kind: 'bid', playerId: 'p1', name: 'Anna', action: 'bid', value: 18, ...meta })).toBe('Anna bids 18');
    expect(text({ kind: 'bid', playerId: 'p1', name: 'Anna', action: 'hold', value: null, ...meta })).toBe('Anna holds');
    expect(text({ kind: 'bid', playerId: 'p1', name: 'Anna', action: 'pass', value: null, ...meta })).toBe('Anna passes');
    expect(text({ kind: 'bid', playerId: 'p1', name: 'Anna', action: 'claim', value: 18, ...meta })).toBe('Anna plays at 18');
    expect(text({ kind: 'skat', playerId: 'p1', name: 'Anna', pickedUp: true, ...meta })).toBe('Anna picks up the Skat');
    expect(text({ kind: 'skat', playerId: 'p1', name: 'Anna', pickedUp: false, ...meta })).toBe('Anna plays Hand');
    expect(text({ kind: 'declared', playerId: 'p1', name: 'Anna', declaration, ...meta })).toBe('Anna announces Diamonds Hand');
    expect(text({ kind: 'aborted', number: 3, ...meta })).toBe('Game 3 was aborted');
  });

  it('describes a won or lost game with its points, and a Null game without points', () => {
    const played = {
      kind: 'result' as const, number: 1, outcome: 'played' as const, declarerId: 'p1', declarerName: 'Anna',
      game: 'diamonds' as const, won: true, gameValue: 9, declarerPoints: 61, defenderPoints: 59,
      loserNames: [], durchmarschName: null, ...meta,
    };
    expect(text(played)).toBe('Anna won Diamonds (9), card points 61 : 59');
    expect(text({ ...played, won: false, gameValue: 18 })).toBe('Anna lost Diamonds (18), card points 61 : 59');
    const nullGame = { ...played, game: 'null' as const, declarerPoints: null, defenderPoints: null, gameValue: 23 };
    expect(text(nullGame)).toBe('Anna won Null (23)');
    expect(text({ ...nullGame, won: false })).toBe('Anna lost Null (23)');
  });

  it('describes a game in which everybody passed', () => {
    expect(text({
      kind: 'result', number: 4, outcome: 'passed-in', declarerId: null, declarerName: null, game: null,
      won: null, gameValue: null, declarerPoints: null, defenderPoints: null, loserNames: [], durchmarschName: null, ...meta,
    })).toBe('Game 4: everybody passed');
  });

  it('describes a Ramsch: its start, its losers and a Durchmarsch', () => {
    expect(text({ kind: 'ramsch', number: 5, ...meta })).toBe('Everybody passed: Ramsch');
    const ramsch = {
      kind: 'result' as const, number: 5, outcome: 'ramsch' as const, declarerId: null, declarerName: null, game: null,
      won: null, gameValue: null, declarerPoints: null, defenderPoints: null, ...meta,
    };
    expect(text({ ...ramsch, loserNames: ['Anna', 'Ben'], durchmarschName: null })).toBe('Ramsch: Anna, Ben lost');
    expect(text({ ...ramsch, loserNames: [], durchmarschName: 'Ben' })).toBe('Ramsch: Durchmarsch by Ben');
  });

  it('describes the start of Bock games', () => {
    expect(text({ kind: 'bock-started', games: 3, ...meta })).toBe('60 : 60 — the next 3 games are Bock games');
  });
});
