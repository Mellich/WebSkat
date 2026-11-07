// Another player: card backs (or open cards for an ouvert declarer), name, role and count.

import type { CardId } from '../../engine';
import type { BackIndex } from '../assets';
import { cls } from '../classNames';
import { cardLabel } from '../cardNames';
import { Card } from './Card';
import styles from './OpponentSeat.module.css';

export interface OpponentSeatProps {
  readonly name: string;
  readonly role?: string;
  readonly count: number;
  readonly isTurn?: boolean;
  readonly isDeclarer?: boolean;
  readonly openCards?: readonly CardId[];
  readonly back?: BackIndex;
  readonly labelOf?: (card: CardId) => string;
}

const MAX_BACKS = 10;

interface Shown {
  readonly key: string;
  readonly id: CardId | 'back';
  readonly label: string;
}

function shownCards(count: number, openCards: readonly CardId[], labelOf: (card: CardId) => string): Shown[] {
  if (openCards.length > 0) {
    return openCards.map((card) => ({ key: card, id: card, label: labelOf(card) }));
  }
  return Array.from({ length: Math.min(count, MAX_BACKS) }, (_, i) => ({
    key: `back-${String(i)}`,
    id: 'back' as const,
    label: 'Card back',
  }));
}

export function OpponentSeat(props: OpponentSeatProps) {
  const { name, role, count, isTurn = false, isDeclarer = false, openCards = [], back, labelOf = cardLabel } = props;
  return (
    <section
      className={cls(styles.seat, isTurn && styles.turn, isDeclarer && styles.declarer)}
      aria-label={`${name}, ${String(count)} cards`}
      data-testid="opponent-seat"
    >
      <header className={styles.header}>
        <span className={styles.name}>{name}</span>
        {role === undefined ? null : <span className={styles.role}>{role}</span>}
        <span className={styles.count} aria-hidden="true">×{count}</span>
      </header>
      <div className={cls(styles.cards, openCards.length > 0 ? styles.open : styles.backs)}>
        {shownCards(count, openCards, labelOf).map((c) => (
          <Card key={c.key} id={c.id} label={c.label} size="opponent" {...(back === undefined ? {} : { back })} />
        ))}
      </div>
    </section>
  );
}
