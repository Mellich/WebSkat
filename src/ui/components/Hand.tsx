// The viewer's own cards, sorted for display. Interactive hands render every card as a button;
// cards that are not `legal` (or all cards while `paused`) are disabled. The UI never decides
// legality itself (docs/ui.md §10).

import { sortHand, type CardId, type Declaration } from '../../engine';
import { cardLabel } from '../cardNames';
import type { BackIndex } from '../assets';
import { Card, type CardState } from './Card';
import styles from './Hand.module.css';

export interface HandProps {
  readonly cards: readonly CardId[];
  readonly declaration: Declaration | null;
  /** Cards the viewer may click right now (from `view.game.legal`). */
  readonly legal: readonly CardId[];
  /** Show the hand at full brightness when card legality is not relevant (e.g. bidding). */
  readonly showAll?: boolean;
  readonly paused?: boolean;
  readonly mode?: 'play' | 'discard';
  readonly selected?: readonly CardId[];
  readonly highlight?: readonly CardId[];
  readonly onPlay?: (card: CardId) => void;
  readonly onToggle?: (card: CardId) => void;
  readonly label?: (card: CardId) => string;
  readonly back?: BackIndex;
}

function stateOf(card: CardId, props: HandProps): CardState {
  if (props.selected?.includes(card) === true) return 'selected';
  if (props.highlight?.includes(card) === true) return 'highlight';
  return props.showAll === true || props.legal.includes(card) ? 'normal' : 'disabled';
}

export function Hand(props: HandProps) {
  const { cards, declaration, legal, mode = 'play', onPlay, onToggle, label = cardLabel } = props;
  const handlerFor = mode === 'discard' ? onToggle : onPlay;
  const interactive = handlerFor !== undefined && props.showAll !== true;
  return (
    <div
      className={styles.hand}
      role="group"
      aria-label="Your hand"
      style={{ '--hand-n': Math.max(2, cards.length) } as React.CSSProperties & Record<'--hand-n', number>}
    >
      {sortHand(cards, declaration).map((card) => {
        const enabled = legal.includes(card) && props.paused !== true;
        const state = stateOf(card, props);
        const testId = `hand-card-${card}`;
        if (!interactive) {
          return <Card key={card} id={card} label={label(card)} state={state} size="hand" testId={testId} />;
        }
        return enabled ? (
          <Card key={card} id={card} label={label(card)} state={state} size="hand" testId={testId} onClick={() => { handlerFor(card); }} />
        ) : (
          <Card key={card} id={card} label={label(card)} state={state} size="hand" testId={testId} disabled />
        );
      })}
    </div>
  );
}
