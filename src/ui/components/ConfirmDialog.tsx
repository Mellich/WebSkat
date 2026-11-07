// Modal question with confirm and cancel. Esc cancels; the confirm button has the initial focus.

import { useEffect, useRef } from 'react';
import { useT } from '../i18n';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  readonly message: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  const t = useT();
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);
  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={message}>
        <p>{message}</p>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
          <button type="button" ref={confirmRef} onClick={onConfirm}>{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}
