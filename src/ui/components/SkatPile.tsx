// The two face-down Skat cards on the table during bidding and skat decision.

import type { BackIndex } from '../assets';
import { Card } from './Card';
import styles from './SkatPile.module.css';

export interface SkatPileProps {
  readonly visible: boolean;
  readonly back?: BackIndex;
  readonly label?: string;
}

export function SkatPile({ visible, back, label = 'Skat' }: SkatPileProps) {
  if (!visible) return null;
  return (
    <div className={styles.pile} role="img" aria-label={`${label}: two cards face down`} data-testid="skat-pile">
      <div className={styles.first}>
        <Card id="back" label="Card back" size="opponent" {...(back === undefined ? {} : { back })} />
      </div>
      <div className={styles.second}>
        <Card id="back" label="Card back" size="opponent" {...(back === undefined ? {} : { back })} />
      </div>
    </div>
  );
}
