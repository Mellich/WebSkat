// Settings: language, card back (with previews), two-tap play, trick display time and scoring.

import { useEffect } from 'react';
import type { BackIndex } from '../assets';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { Card } from './Card';
import styles from './SettingsDialog.module.css';

const BACKS: readonly BackIndex[] = [0, 1, 2, 3];

export interface SettingsDialogProps {
  readonly onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const t = useT();
  const settings = useSettings();
  const { update } = settings;

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
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('settings.title')}>
        <header className={styles.header}>
          <h2>{t('settings.title')}</h2>
          <button type="button" onClick={onClose}>{t('common.close')}</button>
        </header>

        <label className={styles.field}>
          <span>{t('settings.language')}</span>
          <select
            value={settings.language}
            onChange={(e) => {
              update({ language: e.target.value === 'de' ? 'de' : 'en' });
            }}
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </label>

        <fieldset className={styles.field}>
          <legend>{t('settings.cardBack')}</legend>
          <div className={styles.backs}>
            {BACKS.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={settings.cardBack === i}
                className={settings.cardBack === i ? styles.picked : undefined}
                onClick={() => {
                  update({ cardBack: i });
                }}
              >
                <Card id="back" label={`${t('settings.cardBack')} ${String(i + 1)}`} size="opponent" back={i} />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.field}>
          <legend>{t('settings.confirm')}</legend>
          {(['auto', 'always', 'never'] as const).map((mode) => (
            <label key={mode} className={styles.radio}>
              <input
                type="radio"
                name="confirm"
                checked={settings.confirmPlay === mode}
                onChange={() => {
                  update({ confirmPlay: mode });
                }}
              />
              {mode === 'auto' ? t('settings.confirmAuto') : mode === 'always' ? t('settings.confirmAlways') : t('settings.confirmNever')}
            </label>
          ))}
        </fieldset>

        <label className={styles.field}>
          <span>{t('settings.trickDisplay')}</span>
          <select
            data-testid="setting-trick-display"
            value={settings.trickDisplayMs}
            onChange={(e) => { update({ trickDisplayMs: Number(e.target.value) as 0 | 300 | 600 | 1000 | 2000 }); }}
          >
            <option value={0}>{t('settings.trickDisplayOff')}</option>
            <option value={300}>{t('settings.trickDisplayShort')}</option>
            <option value={600}>{t('settings.trickDisplayDefault')}</option>
            <option value={1000}>{t('settings.trickDisplayLong')}</option>
            <option value={2000}>{t('settings.trickDisplayVeryLong')}</option>
          </select>
        </label>

        <fieldset className={styles.field}>
          <legend>{t('stats.scoring')}</legend>
          {(['seeger', 'standard'] as const).map((mode) => (
            <label key={mode} className={styles.radio}>
              <input
                type="radio"
                name="scoring"
                checked={settings.scoring === mode}
                onChange={() => {
                  update({ scoring: mode });
                }}
              />
              {mode === 'seeger' ? t('stats.seeger') : t('stats.standard')}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
