// One card face or back. A `<button>` when it is clickable or disabled (interactive hands);
// otherwise a plain image.

import type { CardId } from '../../engine';
import { DEFAULT_BACK, backUrl, cardUrl, type BackIndex } from '../assets';
import { cls } from '../classNames';
import styles from './Card.module.css';

export type CardState = 'normal' | 'disabled' | 'selected' | 'highlight';

export interface CardProps {
  readonly id: CardId | 'back';
  readonly label: string;
  /** Visual state: `disabled` draws the grey overlay (illegal card), it does not block clicks. */
  readonly state?: CardState;
  readonly size?: 'hand' | 'opponent' | 'trick';
  readonly back?: BackIndex;
  readonly onClick?: () => void;
  /** Not clickable right now: rendered as a disabled button with `aria-disabled`. */
  readonly disabled?: boolean;
  readonly testId?: string;
}

export function Card({
  id,
  label,
  state = 'normal',
  size = 'hand',
  back = DEFAULT_BACK,
  onClick,
  disabled,
  testId,
}: CardProps) {
  const src = id === 'back' ? backUrl(back) : cardUrl(id);
  const className = cls(
    styles.card,
    styles[size],
    state === 'selected' && styles.selected,
    state === 'highlight' && styles.highlight,
    state === 'disabled' && styles.disabled,
  );
  if (onClick === undefined && disabled !== true) {
    return (
      <img
        className={className}
        src={src}
        alt={label}
        width={128}
        height={178}
        decoding="async"
        draggable={false}
        data-testid={testId}
      />
    );
  }
  const isDisabled = disabled === true;
  return (
    <button
      type="button"
      className={className}
      onClick={isDisabled ? undefined : onClick}
      data-testid={testId}
      disabled={isDisabled}
      aria-disabled={isDisabled ? true : undefined}
      aria-label={label}
      aria-pressed={state === 'selected' ? true : undefined}
    >
      <img src={src} alt="" width={128} height={178} decoding="async" draggable={false} />
    </button>
  );
}
