// One card face or back. A `<button>` only when it can be clicked; otherwise a plain image.

import type { CardId } from '../../engine';
import { DEFAULT_BACK, backUrl, cardUrl, type BackIndex } from '../assets';
import { cls } from '../classNames';
import styles from './Card.module.css';

export type CardState = 'normal' | 'disabled' | 'selected' | 'highlight';

export interface CardProps {
  readonly id: CardId | 'back';
  readonly label: string;
  readonly state?: CardState;
  readonly size?: 'hand' | 'opponent' | 'trick';
  readonly back?: BackIndex;
  readonly onClick?: () => void;
}

export function Card({ id, label, state = 'normal', size = 'hand', back = DEFAULT_BACK, onClick }: CardProps) {
  const src = id === 'back' ? backUrl(back) : cardUrl(id);
  const className = cls(
    styles.card,
    styles[size],
    state === 'selected' && styles.selected,
    state === 'highlight' && styles.highlight,
    state === 'disabled' && styles.disabled,
  );
  if (onClick === undefined) {
    return (
      <img
        className={className}
        src={src}
        alt={label}
        width={128}
        height={178}
        decoding="async"
        draggable={false}
      />
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={state === 'disabled'}
      aria-label={label}
      aria-pressed={state === 'selected' ? true : undefined}
    >
      <img src={src} alt="" width={128} height={178} decoding="async" draggable={false} />
    </button>
  );
}
