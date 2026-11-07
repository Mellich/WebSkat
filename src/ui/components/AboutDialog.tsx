// About WebSkat: how it works, whom you trust, and what this browser stores (docs/11 §4).

import { useEffect } from 'react';
import { useT } from '../i18n';
import styles from './AboutDialog.module.css';

export interface AboutDialogProps {
  readonly onClose: () => void;
}

export function AboutDialog({ onClose }: AboutDialogProps) {
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
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('about.title')}>
        <header className={styles.header}>
          <h2>{t('about.title')}</h2>
          <button type="button" onClick={onClose}>{t('common.close')}</button>
        </header>
        <p>{t('about.how')}</p>
        <p>{t('about.trust')}</p>
        <p>{t('about.privacy')}</p>
        <p>{t('about.storage')}</p>
      </div>
    </div>
  );
}
