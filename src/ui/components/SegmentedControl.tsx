// SegmentedControl: one choice out of a few short options, shown as joined pills. Native radio
// inputs underneath, so keyboard and screen readers work as for any radio group.

import { useId } from 'react';
import { cls } from '../classNames';
import styles from './SegmentedControl.module.css';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T extends string> {
  readonly label: string;
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly testId?: string;
}

export function SegmentedControl<T extends string>({ label, options, value, onChange, testId }: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={styles.group} data-testid={testId}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label key={option.value} className={cls(styles.segment, checked && styles.checked)}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => {
                onChange(option.value);
              }}
              className={styles.input}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
