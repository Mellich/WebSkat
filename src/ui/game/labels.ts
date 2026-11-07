// Text for game terms, cards and declarations. Read-only helpers: they never decide legality.

import { rankOf, suitOf, type CardId, type Declaration, type Rank, type Suit } from '../../engine';
import type { Translator } from '../i18n';
import type { TranslationKey } from '../i18n/en';

const RANK_KEYS: Readonly<Record<Rank, TranslationKey>> = {
  '7': 'rank.7',
  '8': 'rank.8',
  '9': 'rank.9',
  '10': 'rank.10',
  J: 'rank.J',
  Q: 'rank.Q',
  K: 'rank.K',
  A: 'rank.A',
};

const SUIT_KEYS: Readonly<Record<Suit, TranslationKey>> = {
  C: 'game.clubs',
  S: 'game.spades',
  H: 'game.hearts',
  D: 'game.diamonds',
};

const SUIT_NAME_KEYS: Readonly<Record<Suit, TranslationKey>> = {
  C: 'suit.C',
  S: 'suit.S',
  H: 'suit.H',
  D: 'suit.D',
};

const SHORT_RANK_KEYS: Readonly<Record<Rank, TranslationKey>> = {
  '7': 'rankShort.7', '8': 'rankShort.8', '9': 'rankShort.9', '10': 'rankShort.10',
  J: 'rankShort.J', Q: 'rankShort.Q', K: 'rankShort.K', A: 'rankShort.A',
};

export function cardShort(card: CardId, t: Translator): { suit: string; rank: string; red: boolean } {
  const suit = suitOf(card);
  return { suit: suitSymbol(suit), rank: t(SHORT_RANK_KEYS[rankOf(card)]), red: suit === 'H' || suit === 'D' };
}

/** "Queen of hearts", or "Dame Herz" in German. */
export function cardName(card: CardId, t: Translator): string {
  return t('card.label', { rank: t(RANK_KEYS[rankOf(card)]), suit: t(SUIT_NAME_KEYS[suitOf(card)]) });
}

/** "Hearts Hand Schneider Ouvert": the game as it is declared. */
export function declarationLabel(d: Declaration, t: Translator): string {
  const parts: string[] = [];
  if (d.kind === 'suit') parts.push(t(SUIT_KEYS[d.trump]));
  else if (d.kind === 'grand') parts.push(t('game.grand'));
  else parts.push(t('game.null'));
  if (d.hand) parts.push(t('game.hand'));
  if (d.kind !== 'null' && d.announce === 'schneider') parts.push(t('game.schneider'));
  if (d.kind !== 'null' && d.announce === 'schwarz') parts.push(t('game.schwarz'));
  if (d.ouvert) parts.push(t('game.ouvert'));
  return parts.join(' ');
}

export function suitKey(suit: Suit): TranslationKey {
  return SUIT_KEYS[suit];
}

export function spitzenLabel(spitzen: { readonly with: boolean; readonly count: number }, t: Translator): string {
  return spitzen.with ? t('game.with', { count: spitzen.count }) : t('game.without', { count: spitzen.count });
}

export function suitSymbol(suit: Suit): string {
  return { C: '♣', S: '♠', H: '♥', D: '♦' }[suit];
}

export type { Suit };
