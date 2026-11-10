// The text of one game-log entry (docs/ui.md §10). Pure: entries are data, the words are here.

import { assertNever } from '../../engine';
import type { GameKindLabel, LogEntry } from '../../table';
import { declarationLabel } from '../game/labels';
import type { Translator } from '../i18n';
import type { TranslationKey } from '../i18n/en';

const GAME_KEYS: Readonly<Record<GameKindLabel, TranslationKey>> = {
  clubs: 'game.clubs',
  spades: 'game.spades',
  hearts: 'game.hearts',
  diamonds: 'game.diamonds',
  grand: 'game.grand',
  null: 'game.null',
};

const BID_KEYS = {
  bid: 'log.bid',
  hold: 'log.hold',
  pass: 'log.pass',
  claim: 'log.claim',
} as const satisfies Record<'bid' | 'hold' | 'pass' | 'claim', TranslationKey>;

/** Text for a finished game: who won which game, with the card points unless it is Null. */
function resultText(e: Extract<LogEntry, { kind: 'result' }>, t: Translator): string {
  if (e.outcome === 'ramsch') {
    if (e.durchmarschName !== null) return t('log.durchmarsch', { name: e.durchmarschName });
    return t('log.ramschLost', { names: e.loserNames.join(', ') });
  }
  if (e.outcome === 'passed-in' || e.declarerName === null || e.game === null || e.won === null) {
    return t('log.passedIn', { number: e.number });
  }
  const params = { name: e.declarerName, game: t(GAME_KEYS[e.game]), value: e.gameValue ?? 0 };
  if (e.declarerPoints === null || e.defenderPoints === null) {
    return t(e.won ? 'log.wonNull' : 'log.lostNull', params);
  }
  return t(e.won ? 'log.won' : 'log.lost', {
    ...params,
    declarer: e.declarerPoints,
    defenders: e.defenderPoints,
  });
}

export function logText(entry: LogEntry, t: Translator): string {
  switch (entry.kind) {
    case 'joined':
      if (entry.isBot) return t('log.botAdded', { name: entry.name });
      return t(entry.pending ? 'log.joinedPending' : 'log.joined', { name: entry.name });
    case 'reconnected':
      return t('log.reconnected', { name: entry.name });
    case 'disconnected':
      return t('log.disconnected', { name: entry.name });
    case 'left':
      return t('log.left', { name: entry.name });
    case 'kicked':
      return t('log.kicked', { name: entry.name });
    case 'replaced':
      return t('log.replaced', { by: entry.byName, name: entry.name });
    case 'dealt':
      return t(entry.bock ? 'log.dealtBock' : 'log.dealt', { number: entry.number, name: entry.dealerName });
    case 'bid':
      return entry.action === 'bid' || entry.action === 'claim'
        ? t(BID_KEYS[entry.action], { name: entry.name, value: entry.value ?? 0 })
        : t(BID_KEYS[entry.action], { name: entry.name });
    case 'skat':
      return entry.pickedUp
        ? t('log.skatTaken', { name: entry.name })
        : t('log.hand', { name: entry.name });
    case 'declared':
      return t('log.declared', { name: entry.name, game: declarationLabel(entry.declaration, t) });
    case 'ramsch':
      return t('log.ramsch');
    case 'bock-started':
      return t('log.bockStarted', { games: entry.games });
    case 'doubled':
      return t(entry.level === 2 ? 'log.kontra' : 'log.re', { name: entry.name });
    case 'aborted':
      return t('log.aborted', { number: entry.number });
    case 'result':
      return resultText(entry, t);
    default:
      return assertNever(entry);
  }
}
