// Declaring the game, step by step: the game first, then the announcements that exist for it.
// Only entries of `options` (from `legal.declarations`) can be sent (docs/06-ui-ux.md §1).

import { useState } from 'react';
import { declarationFloorValue, type Declaration, type Suit } from '../../engine';
import type { DeclarerSpitzen } from '../../table';
import { useT } from '../i18n';
import { suitKey, suitSymbol } from './labels';

export interface DeclarationPickerProps {
  readonly options: readonly Declaration[];
  readonly spitzen: DeclarerSpitzen | null;
  readonly bid: number | null;
  readonly onDeclare: (declaration: Declaration) => void;
}

type GameChoice = { readonly kind: 'suit'; readonly trump: Suit } | { readonly kind: 'grand' } | { readonly kind: 'null' };

const SUITS: readonly Suit[] = ['C', 'S', 'H', 'D'];

function sameGame(d: Declaration, choice: GameChoice): boolean {
  if (choice.kind === 'suit') return d.kind === 'suit' && d.trump === choice.trump;
  return d.kind === choice.kind;
}

function sameChoice(a: GameChoice, b: GameChoice): boolean {
  if (a.kind === 'suit' && b.kind === 'suit') return a.trump === b.trump;
  return a.kind === b.kind;
}

function announceOf(d: Declaration): 'none' | 'schneider' | 'schwarz' {
  return d.kind === 'null' ? 'none' : d.announce;
}

export function DeclarationPicker({ options, spitzen, bid, onDeclare }: DeclarationPickerProps) {
  const t = useT();
  const [choice, setChoice] = useState<GameChoice | null>(null);
  const [announce, setAnnounce] = useState<'none' | 'schneider' | 'schwarz'>('none');
  const [ouvert, setOuvert] = useState(false);

  const candidates = choice === null ? [] : options.filter((d) => sameGame(d, choice));
  const announces = [...new Set(candidates.map(announceOf))];
  const ouverts = [...new Set(candidates.map((d) => d.ouvert))];
  const matched = candidates.find((d) => announceOf(d) === announce && d.ouvert === ouvert);

  const pick = (next: GameChoice): void => {
    setChoice(next);
    const first = options.find((d) => sameGame(d, next));
    setAnnounce(first === undefined ? 'none' : announceOf(first));
    setOuvert(first?.ouvert ?? false);
  };

  const spitzenCount = (d: Declaration): number | null => {
    if (spitzen === null) return null;
    if (d.kind === 'suit') return spitzen.suit[d.trump].count;
    if (d.kind === 'grand') return spitzen.grand.count;
    return null;
  };
  const floor = matched === undefined ? null : declarationFloorValue(matched, spitzenCount(matched));
  const games: GameChoice[] = [...SUITS.map((trump): GameChoice => ({ kind: 'suit', trump })), { kind: 'grand' }, { kind: 'null' }];
  const label = (c: GameChoice): string => {
    if (c.kind === 'suit') return `${suitSymbol(c.trump)} ${t(suitKey(c.trump))}`;
    return c.kind === 'grand' ? t('game.grand') : t('game.null');
  };

  return (
    <section className="declare" aria-label={t('declare.title')}>
      <h3>{t('declare.title')}</h3>
      <fieldset>
        <legend>{t('declare.game')}</legend>
        <div className="declare-games">
          {games.map((g) => {
            const available = options.some((d) => sameGame(d, g));
            return (
              <button
                key={label(g)}
                type="button"
                aria-pressed={choice !== null && sameChoice(choice, g)}
                disabled={!available}
                onClick={() => { pick(g); }}
              >
                {label(g)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {choice !== null && (announces.length > 1 || ouverts.length > 1) ? (
        <fieldset>
          <legend>{t('declare.extras')}</legend>
          {announces.map((a) => (
            <label key={a}>
              <input type="radio" name="announce" checked={announce === a} onChange={() => { setAnnounce(a); }} />
              {a === 'none' ? t('declare.normal') : a === 'schneider' ? t('declare.schneider') : t('declare.schwarz')}
            </label>
          ))}
          {ouverts.includes(true) ? (
            <label>
              <input type="checkbox" checked={ouvert} onChange={(e) => { setOuvert(e.target.checked); }} />
              {t('declare.ouvert')}
            </label>
          ) : null}
        </fieldset>
      ) : null}

      <p aria-live="polite">
        {choice === null ? t('declare.choose') : matched === undefined ? t('declare.none') : null}
        {floor === null ? null : t('declare.floor', { value: floor })}
        {floor !== null && bid !== null && floor < bid ? ` ${t('declare.overbid', { bid })}` : null}
      </p>
      <button
        type="button"
        disabled={matched === undefined}
        onClick={() => {
          if (matched !== undefined) onDeclare(matched);
        }}
      >
        {t('declare.button')}
      </button>
    </section>
  );
}
