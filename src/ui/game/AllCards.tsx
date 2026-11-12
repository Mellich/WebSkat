// "Show all cards" button of the result dialog: toggles the dealt hands of every player and the Skat.

import { useState } from 'react';
import { CardChips } from '../components/CardChip';
import { useT } from '../i18n';
import type { RevealedHands } from './revealedHands';
import styles from './AllCards.module.css';

export function AllCards({ hands }: { readonly hands: RevealedHands }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); }}
        data-testid="show-all-cards"
      >
        {open ? t('result.hideAllCards') : t('result.showAllCards')}
      </button>
      {open ? (
        <ul className={styles.list} data-testid="all-cards">
          {hands.players.map((p, i) => (
            <li key={`player-${String(i)}`} className={styles.row}>
              <span>{p.name}</span>
              <CardChips cards={p.cards} />
            </li>
          ))}
          {hands.skat === null ? null : (
            <li className={styles.row}>
              <span>{t('result.skat')}</span>
              <CardChips cards={hands.skat} />
            </li>
          )}
        </ul>
      ) : null}
    </>
  );
}
