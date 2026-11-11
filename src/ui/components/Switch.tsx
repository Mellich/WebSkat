// Switch: an on/off toggle with a label. A native checkbox underneath (so tests and assistive tech see
// a checkbox); the whole row is the click target.

import type { ReactNode } from 'react';
import { cls } from '../classNames';
import styles from './Switch.module.css';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly testId?: string;
  readonly children: ReactNode;
}

export function Switch({ checked, onChange, disabled = false, testId, children }: SwitchProps) {
  return (
    <label className={cls(styles.row, disabled && styles.disabled)}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        data-testid={testId}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span className={styles.text}>{children}</span>
    </label>
  );
}
