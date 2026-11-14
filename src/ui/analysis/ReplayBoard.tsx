// The replay table: the three hands face up and the current trick in the middle. Only the cards of
// the player to move are buttons (`position.playable`); a click calls `onChoose`.

import { ROLES, sortHand, type CardId } from '../../engine';
import type { AnalysisInput, CardStat, Position } from '../../table';
import { Card } from '../components/Card';
import { cardName } from '../game/labels';
import { useT } from '../i18n';
import { SeatHand } from './SeatHand';
import styles from './ReplayBoard.module.css';

export interface ReplayBoardProps {
  readonly input: AnalysisInput;
  readonly position: Position;
  readonly stats: readonly CardStat[];
  readonly best: readonly CardId[];
  readonly actualNext: CardId | null;
  readonly onChoose: (card: CardId) => void;
}

export function ReplayBoard({ input, position, stats, best, actualNext, onChoose }: ReplayBoardProps) {
  const t = useT();
  return (
    <section className={styles.board} data-testid="analysis-board">
      {ROLES.map((role) => (
        <SeatHand
          key={role}
          role={role}
          name={input.names[role]}
          active={position.mover === role}
          points={position.points[role]}
          tricks={position.tricksWon[role]}
          hand={sortHand(position.hands[role], input.declaration)}
          playable={position.playable}
          stats={stats}
          best={best}
          actualNext={actualNext}
          onChoose={onChoose}
        />
      ))}
      <div className={styles.trick} data-testid="analysis-trick">
        {position.trick.plays.map((play) => (
          <span key={play.card} className={styles.played}>
            <Card id={play.card} label={cardName(play.card, t)} size="trick" />
            <span className={styles.caption}>{input.names[play.role]}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
