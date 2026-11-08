// The cards of the current trick, in three fixed slots (docs/ui.md §10).

import type { CardId } from '../../engine';
import { cls } from '../classNames';
import { cardLabel } from '../cardNames';
import { Card } from './Card';
import styles from './TrickArea.module.css';

export interface TrickSlot {
  readonly card: CardId;
  readonly name: string;
  readonly winner?: boolean;
}

export interface TrickAreaProps {
  /** Up to three slots, in play order. */
  readonly slots: readonly TrickSlot[];
  readonly labelOf?: (card: CardId) => string;
  readonly onDismiss?: () => void;
  readonly dismissLabel?: string;
}

const SLOTS = 3;

export function TrickArea({ slots, labelOf = cardLabel, onDismiss, dismissLabel = 'Continue' }: TrickAreaProps) {
  const content = (
    <div className={styles.trick} role="group" aria-label="Current trick" data-testid="trick-area">
      {Array.from({ length: SLOTS }, (_, i) => {
        const slot = slots[i];
        return (
          <div key={i} className={styles.slot}>
            {slot === undefined ? (
              <span className={styles.empty} aria-hidden="true" />
            ) : (
              <>
                <div className={cls(styles.card, slot.winner === true && styles.winner)}>
                  <Card id={slot.card} label={labelOf(slot.card)} size="trick" />
                </div>
                <span className={styles.name}>{slot.name}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
  return onDismiss === undefined ? content : (
    <button type="button" className={styles.dismiss} aria-label={dismissLabel} data-testid="trick-dismiss" onClick={onDismiss}>
      {content}
    </button>
  );
}
