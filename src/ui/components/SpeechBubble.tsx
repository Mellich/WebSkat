// A small speech bubble with a tail toward its speaker. The parent positions it (docs/ui-game-screen.md §4).

import { cls } from '../classNames';
import styles from './SpeechBubble.module.css';

export interface SpeechBubbleProps {
  readonly text: string;
  /** `below`: the tail points up to a speaker above the bubble; `above`: the tail points down. */
  readonly placement: 'below' | 'above';
  readonly testId?: string;
}

export function SpeechBubble({ text, placement, testId }: SpeechBubbleProps) {
  return (
    <div
      className={cls(styles.bubble, placement === 'below' ? styles.below : styles.above)}
      data-testid={testId}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}
