// Tabs: buttons that switch the content of a dialog (roving tabindex, Left/Right/Home/End keys).

import { useRef, type KeyboardEvent } from 'react';
import styles from './Tabs.module.css';

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly testId?: string;
}

export interface TabsProps<T extends string> {
  readonly label: string;
  readonly items: readonly TabItem<T>[];
  readonly value: T;
  readonly onChange: (id: T) => void;
}

export function Tabs<T extends string>({ label, items, value, onChange }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, step: number | 'first' | 'last') => {
    const count = items.length;
    const next = step === 'first' ? 0 : step === 'last' ? count - 1 : (from + step + count) % count;
    const item = items[next];
    if (item === undefined) return;
    onChange(item.id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight') move(index, 1);
    else if (e.key === 'ArrowLeft') move(index, -1);
    else if (e.key === 'Home') move(index, 'first');
    else if (e.key === 'End') move(index, 'last');
    else return;
    e.preventDefault();
  };

  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            data-testid={item.testId}
            className={selected ? styles.selected : styles.tab}
            onKeyDown={onKeyDown(index)}
            onClick={() => {
              onChange(item.id);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
