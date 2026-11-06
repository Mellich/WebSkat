// Dev-only gallery (`#/dev/gallery`, loaded only in development builds). Shows every card,
// the backs, a hand with disabled cards, a trick and the seats, for visual checks.

import { ALL_CARDS, type CardId } from '../../engine';
import type { BackIndex } from '../assets';
import { cardLabel } from '../cardNames';
import { Card } from '../components/Card';
import { Hand } from '../components/Hand';
import { OpponentSeat } from '../components/OpponentSeat';
import { SkatPile } from '../components/SkatPile';
import { TrickArea, type TrickSlot } from '../components/TrickArea';
import styles from './Gallery.module.css';

const HAND: CardId[] = ['CJ', 'SJ', 'HA', 'H10', 'D9', 'C7', 'S8', 'DK', 'C10', 'H7'];
const LEGAL: CardId[] = ['CJ', 'HA', 'D9'];
const TRICK: TrickSlot[] = [
  { card: 'CA', name: 'Anna' },
  { card: 'C10', name: 'Ben' },
  { card: 'SJ', name: 'Carl', winner: true },
];
const BACKS: BackIndex[] = [0, 1, 2, 3];

export function Gallery() {
  return (
    <main className={styles.gallery}>
      <h1>Card gallery (dev only)</h1>

      <section>
        <h2>All faces</h2>
        <div className={styles.row}>
          {ALL_CARDS.map((card) => (
            <Card key={card} id={card} label={cardLabel(card)} size="opponent" />
          ))}
        </div>
      </section>

      <section>
        <h2>Backs</h2>
        <div className={styles.row}>
          {BACKS.map((i) => (
            <Card key={i} id="back" label={`Card back ${String(i)}`} size="hand" back={i} />
          ))}
        </div>
      </section>

      <section>
        <h2>Hand (only the bright cards are legal)</h2>
        <Hand cards={HAND} declaration={null} legal={LEGAL} onPlay={() => undefined} />
      </section>

      <section>
        <h2>Trick</h2>
        <TrickArea slots={TRICK} />
      </section>

      <section>
        <h2>Seats and Skat</h2>
        <div className={styles.row}>
          <OpponentSeat name="Anna" role="Forehand" count={10} isTurn />
          <OpponentSeat name="Ben" role="Middlehand" count={7} isDeclarer />
          <OpponentSeat name="Carl" role="Hindhand" count={3} openCards={['CA', 'C10', 'CK']} />
          <SkatPile visible />
        </div>
      </section>
    </main>
  );
}
