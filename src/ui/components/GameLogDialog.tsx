// The game log dialog: every event of the table, oldest first (docs/ui.md §10, plan 10).
// Opened from the top bar; the list follows new entries to the bottom.

import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../table';
import { cls } from '../classNames';
import { useT } from '../i18n';
import { logText } from '../log/logText';
import styles from './GameLogDialog.module.css';

export interface GameLogDialogProps {
  readonly entries: readonly LogEntry[];
  readonly onClose: () => void;
}

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function GameLogDialog({ entries, onClose }: GameLogDialogProps) {
  const t = useT();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const list = listRef.current;
    if (list !== null) list.scrollTop = list.scrollHeight;
  }, [entries.length]);

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('log.title')} data-testid="log-dialog">
        <header className={styles.header}>
          <h2>{t('log.title')}</h2>
          <button type="button" onClick={onClose}>{t('common.close')}</button>
        </header>
        {entries.length === 0 ? (
          <p className={styles.empty}>{t('log.empty')}</p>
        ) : (
          <ol className={styles.list} ref={listRef} data-testid="log-list">
            {entries.map((entry) => (
              <li
                key={entry.n}
                className={cls(styles.entry, entry.kind === 'dealt' && styles.dealt)}
                data-testid="log-entry"
              >
                <time className={styles.time} dateTime={new Date(entry.at).toISOString()}>{timeOf(entry.at)}</time>
                <span>{logText(entry, t)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
