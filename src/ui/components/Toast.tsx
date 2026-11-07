// Short messages from the host or the app, dismissed after a few seconds.

import { useEffect } from 'react';
import { cls } from '../classNames';
import { useT } from '../i18n';
import { useSession } from '../store/session';
import styles from './Toast.module.css';

const TOAST_MS = 4500;

function ToastItem({ id, text, kind }: { readonly id: number; readonly text: string; readonly kind: 'error' | 'info' }) {
  const dismiss = useSession((s) => s.dismiss);
  const t = useT();
  useEffect(() => {
    const timer = setTimeout(() => {
      dismiss(id);
    }, TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [id, dismiss]);
  return (
    <p className={cls(styles.toast, kind === 'error' && styles.error)}>
      <span>{text}</span>
      <button type="button" className={styles.close} onClick={() => { dismiss(id); }} aria-label={t('common.close')}>×</button>
    </p>
  );
}

export function Toasts() {
  const toasts = useSession((s) => s.toasts);
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} text={t.text} kind={t.kind} />
      ))}
    </div>
  );
}
