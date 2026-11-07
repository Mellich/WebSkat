import { describe, expect, it } from 'vitest';
import type { CardId } from '../../engine';
import { translate } from '../i18n';
import { cardName, cardShort, declarationLabel } from './labels';

const en = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
  translate('en', key, params);
const de = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
  translate('de', key, params);

describe('cardName', () => {
  it.each([
    ['CJ', 'Jack of clubs', 'Bube Kreuz'],
    ['H10', 'Ten of hearts', 'Zehn Herz'],
    ['SA', 'Ace of spades', 'Ass Pik'],
  ] as [CardId, string, string][])('%s', (card, english, german) => {
    expect(cardName(card, en)).toBe(english);
    expect(cardName(card, de)).toBe(german);
  });
});

describe('cardShort', () => {
  it('formats localized short rank and suit color', () => {
    expect(cardShort('HJ', en)).toEqual({ suit: '♥', rank: 'J', red: true });
    expect(cardShort('HJ', de)).toEqual({ suit: '♥', rank: 'B', red: true });
    expect(cardShort('C10', en)).toEqual({ suit: '♣', rank: '10', red: false });
  });
});

describe('declarationLabel', () => {
  it.each([
    [{ kind: 'suit', trump: 'H', hand: false, announce: 'none', ouvert: false }, 'Hearts'],
    [{ kind: 'suit', trump: 'C', hand: true, announce: 'schwarz', ouvert: true }, 'Clubs Hand Schwarz Ouvert'],
    [{ kind: 'grand', hand: true, announce: 'schneider', ouvert: false }, 'Grand Hand Schneider'],
    [{ kind: 'null', hand: true, ouvert: true }, 'Null Hand Ouvert'],
  ] as const)('describes %j', (declaration, label) => {
    expect(declarationLabel(declaration, en)).toBe(label);
  });

  it('uses the German game names', () => {
    expect(declarationLabel({ kind: 'suit', trump: 'D', hand: false, announce: 'none', ouvert: false }, de)).toBe('Karo');
  });
});
