// The viewer's own cards, sorted for display. Only `legal` cards are clickable; the UI never
// decides legality itself (docs/06-ui-ux.md §2).

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
  return (
    <div
      className={styles.hand}
      role="group"
      aria-label="Your hand"
      style={{ '--hand-n': Math.max(2, cards.length) } as React.CSSProperties & Record<'--hand-n', number>}
    >
      {sortHand(cards, declaration).map((card) => {
        const enabled = legal.includes(card);
        const handler = enabled && props.paused !== true ? (mode === 'discard' ? onToggle : onPlay) : undefined;
        const state = stateOf(card, props);
        const testId = `hand-card-${card}`;
        return handler === undefined ? (
          <Card key={card} id={card} label={label(card)} state={state} size="hand" testId={testId} />
        ) : (
          <Card key={card} id={card} label={label(card)} state={state} size="hand" testId={testId} onClick={() => { handler(card); }} />
        );
      })}
    </div>
  );
}
