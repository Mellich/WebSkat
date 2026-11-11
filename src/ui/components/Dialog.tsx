// Shared modal shell: backdrop, title bar with an icon close button (×) in the top right, an optional
// toolbar that does not scroll (tabs, segmented controls), and a scrolling body. Esc closes it.
// Docs: ui.md §4.

import { useEffect, type ReactNode } from 'react';
import { cls } from '../classNames';
import { useT } from '../i18n';
import styles from './Dialog.module.css';

export interface DialogProps {
  readonly title: string;
  readonly onClose: () => void;
  readonly size?: 'sm' | 'md' | 'lg';
  /** Buttons shown left of the close button in the title bar. */
  readonly actions?: ReactNode;
  /** Non-scrolling row under the title bar (tabs, segmented controls). */
  readonly toolbar?: ReactNode;
  readonly testId?: string;
  readonly children: ReactNode;
}

export function Dialog({ title, onClose, size = 'md', actions, toolbar, testId, children }: DialogProps) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className={styles.backdrop}>
      <div
        className={cls(styles.dialog, styles[size])}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
      >
        <header className={styles.header}>
          <h2>{title}</h2>
          <div className={styles.actions}>
            {actions}
            <button
              type="button"
              className={styles.close}
              aria-label={t('common.close')}
              title={t('common.close')}
              data-testid="dialog-close"
              onClick={onClose}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6 L18 18 M18 6 L6 18" />
              </svg>
            </button>
          </div>
        </header>
        {toolbar === undefined ? null : <div className={styles.toolbar}>{toolbar}</div>}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
