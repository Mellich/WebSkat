// The cards of the current trick at fixed positions: left, right and bottom (docs/ui.md §10).

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

/** Where a card lies: the left seat, the right seat, or the bottom (the viewer / third active player). */
export type TrickPosition = 'left' | 'right' | 'bottom';

export interface TrickAreaProps {
  readonly slots: Readonly<Record<TrickPosition, TrickSlot | null>>;
  readonly labelOf?: (card: CardId) => string;
  readonly onDismiss?: () => void;
  readonly dismissLabel?: string;
}

const POSITIONS: readonly TrickPosition[] = ['left', 'right', 'bottom'];

export function TrickArea({ slots, labelOf = cardLabel, onDismiss, dismissLabel = 'Continue' }: TrickAreaProps) {
  const content = (
    <div className={styles.trick} role="group" aria-label="Current trick" data-testid="trick-area">
      {POSITIONS.map((pos) => {
        const slot = slots[pos];
        return (
          <div
            key={pos}
            className={cls(styles.slot, styles[pos])}
            data-testid={`trick-slot-${pos}`}
            {...(slot === null ? {} : { 'data-player-name': slot.name })}
          >
            {slot === null ? (
              <span className={styles.empty} aria-hidden="true" />
            ) : (
              <div className={cls(styles.card, slot.winner === true && styles.winner)}>
                <Card id={slot.card} label={labelOf(slot.card)} size="trick" />
                <span className={styles.name}>{slot.name}</span>
              </div>
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
