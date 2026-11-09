// Labels of finished games, shared by the history and the result dialog (docs/statistics.md §3).

import type { GameKindLabel, GameRecord } from '../../table';
import type { Translator } from '../i18n';
import type { TranslationKey } from '../i18n/en';

const KIND_KEYS: Readonly<Record<GameKindLabel, TranslationKey>> = {
  clubs: 'game.clubs',
  spades: 'game.spades',
  hearts: 'game.hearts',
  diamonds: 'game.diamonds',
  grand: 'game.grand',
  null: 'game.null',
};

/** "Grand Hand Schneider Ouvert", or "Passed in" for a game that was not played. */
export function gameLabel(record: GameRecord, t: Translator): string {
  if (record.outcome === 'ramsch') return t('game.ramsch');
  if (record.outcome === 'passed-in' || record.game === null) return t('stats.passedIn');
  const parts = [t(KIND_KEYS[record.game])];
  if (record.hand) parts.push(t('game.hand'));
  if (record.announce === 'schneider') parts.push(t('game.schneider'));
  if (record.announce === 'schwarz') parts.push(t('game.schwarz'));
  if (record.ouvert) parts.push(t('game.ouvert'));
  return parts.join(' ');
}

/** Signed score as shown in lists: "+96" or "−54". */
export function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : value < 0 ? `−${String(Math.abs(value))}` : '0';
}

/** Flags of a finished game: "Schneider, Overbid". */
export function recordFlags(r: GameRecord, t: Translator): string {
  const parts: string[] = [];
  if (r.ramsch?.jungfrau) parts.push(t('game.jungfrau'));
  if (r.ramsch?.durchmarschId) parts.push(t('game.durchmarsch'));
  if (r.bock) parts.push(t('game.bock'));
  if (r.schneider || r.announce === 'schneider') parts.push(t('game.schneider'));
  if (r.schwarz || r.announce === 'schwarz') parts.push(t('game.schwarz'));
  if (r.overbid) parts.push(t('stats.overbid'));
  return parts.join(', ');
}

/** "with 2" / "without 1", or "" when unknown. */
export function spitzenLabel(r: GameRecord, t: Translator): string {
  if (r.spitzenCount === null || r.spitzenWith === null) return '';
  return r.spitzenWith ? t('game.with', { count: r.spitzenCount }) : t('game.without', { count: r.spitzenCount });
}
