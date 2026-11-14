// One seat of the replay board: name, points and tricks, and the hand face up. For the player to
// move, the playable cards are buttons with their win rate; the others are drawn disabled.

import type { CardId, Role } from '../../engine';
import { winRate, type CardStat } from '../../table';
import { Card } from '../components/Card';
import { cardName } from '../game/labels';
import { cls } from '../classNames';
import { useT, type Translator } from '../i18n';
import { percent, winTone } from './scoreFormat';
import { roleKey } from './roleKey';
import styles from './SeatHand.module.css';

export interface SeatHandProps {
  readonly role: Role;
  readonly name: string;
  readonly active: boolean; // the player to move
  readonly points: number;
  readonly tricks: number;
  readonly hand: readonly CardId[];
  readonly playable: readonly CardId[];
  readonly stats: readonly CardStat[];
  readonly best: readonly CardId[];
  readonly actualNext: CardId | null;
  readonly onChoose: (card: CardId) => void;
}

function tricksText(count: number, t: Translator): string {
  return count === 1 ? t('analysis.trickOne') : t('analysis.trickMany', { count });
}

export function SeatHand(props: SeatHandProps) {
  const { role, name, active, points, tricks, hand, playable, stats, best, actualNext, onChoose } = props;
  const t = useT();
  return (
    <section
      className={cls(styles.seat, active && styles.active)}
      data-testid={`analysis-seat-${role}`}
      aria-current={active ? 'true' : undefined}
    >
      <header className={styles.head}>
        <span className={styles.name}>{t(roleKey(role))} · {name}</span>
        <span className={styles.info}>{t('analysis.seatInfo', { points, tricks: tricksText(tricks, t) })}</span>
        {active ? <span className={styles.turn}>{t('analysis.toPlay', { name })}</span> : null}
      </header>
      <div className={styles.cards}>
        {hand.map((card) => (active
          ? <PlayableCell key={card} card={card} isPlayable={playable.includes(card)} stat={stats.find((s) => s.card === card)} isBest={best.includes(card)} isActual={actualNext === card} onChoose={onChoose} />
          : <Card key={card} id={card} label={cardName(card, t)} size="opponent" />))}
      </div>
    </section>
  );
}

interface PlayableCellProps {
  readonly card: CardId;
  readonly isPlayable: boolean;
  readonly stat: CardStat | undefined;
  readonly isBest: boolean;
  readonly isActual: boolean;
  readonly onChoose: (card: CardId) => void;
}

function PlayableCell({ card, isPlayable, stat, isBest, isActual, onChoose }: PlayableCellProps) {
  const t = useT();
  const rate = stat === undefined ? null : winRate(stat);
  const label = cardName(card, t);
  if (!isPlayable) {
    return (
      <span className={styles.cell}>
        <Card id={card} label={label} size="hand" state="disabled" />
      </span>
    );
  }
  return (
    <span className={styles.cell}>
      <Card
        id={card}
        label={t('analysis.cardScore', { card: label, percent: percent(rate) })}
        size="hand"
        state={isBest ? 'highlight' : 'normal'}
        onClick={() => { onChoose(card); }}
        testId={`analysis-card-${card}`}
      />
      <span className={cls(styles.badge, styles[winTone(rate)])}>{percent(rate)}</span>
      {isActual ? <span className={styles.marker}>{t('analysis.played')}</span> : null}
    </span>
  );
}

