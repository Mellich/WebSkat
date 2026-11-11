// Settings in two tabs: Display (language, card back, trick and bid timing) and Play (playing a card,
// scoring). Every change is saved at once. Docs: ui.md §6.

import { useState } from 'react';
import type { BackIndex } from '../assets';
import { useT, type Translator } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import type { Settings } from '../persist/settings';
import { useSettings } from '../store/settings';
import { Card } from './Card';
import { Dialog } from './Dialog';
import { SegmentedControl } from './SegmentedControl';
import { Tabs } from './Tabs';
import styles from './SettingsDialog.module.css';

const BACKS: readonly BackIndex[] = [0, 1, 2, 3];
const CONFIRM_MODES = ['auto', 'always', 'never'] as const;
const SCORING_MODES = ['seeger', 'standard'] as const;

export interface SettingsDialogProps {
  readonly onClose: () => void;
}

type Tab = 'display' | 'play';

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const t = useT();
  const settings = useSettings();
  const { update } = settings;
  const [tab, setTab] = useState<Tab>('display');

  const tabs = [
    { id: 'display' as const, label: t('settings.tabDisplay'), testId: 'settings-tab-display' },
    { id: 'play' as const, label: t('settings.tabPlay'), testId: 'settings-tab-play' },
  ];

  return (
    <Dialog
      title={t('settings.title')}
      onClose={onClose}
      testId="settings-dialog"
      toolbar={<Tabs label={t('settings.title')} items={tabs} value={tab} onChange={setTab} />}
    >
      {tab === 'display' ? (
        <DisplaySettings settings={settings} update={update} t={t} />
      ) : (
        <PlaySettings settings={settings} update={update} t={t} />
      )}
    </Dialog>
  );
}

interface SectionProps {
  readonly settings: Settings;
  readonly update: (patch: Partial<Settings>) => void;
  readonly t: Translator;
}

function DisplaySettings({ settings, update, t }: SectionProps) {
  return (
    <>
      <fieldset className={styles.field}>
        <legend>{t('settings.language')}</legend>
        <SegmentedControl
          label={t('settings.language')}
          testId="setting-language"
          options={[
            { value: 'en', label: 'English' },
            { value: 'de', label: 'Deutsch' },
          ]}
          value={settings.language}
          onChange={(language) => {
            update({ language });
          }}
        />
      </fieldset>

      <fieldset className={styles.field}>
        <legend>{t('settings.cardBack')}</legend>
        <div className={styles.backs}>
          {BACKS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={settings.cardBack === i}
              className={settings.cardBack === i ? styles.picked : styles.back}
              onClick={() => {
                update({ cardBack: i });
              }}
            >
              <Card id="back" label={`${t('settings.cardBack')} ${String(i + 1)}`} size="opponent" back={i} />
            </button>
          ))}
        </div>
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

      <label className={styles.field}>
        <span>{t('settings.bidBubble')}</span>
        <select
          data-testid="setting-bid-bubble"
          value={settings.bidBubbleMs}
          onChange={(e) => { update({ bidBubbleMs: Number(e.target.value) as 0 | 500 | 1000 | 2000 | 3000 }); }}
        >
          <option value={0}>{t('settings.bidBubbleOff')}</option>
          <option value={500}>{t('settings.bidBubbleShort')}</option>
          <option value={1000}>{t('settings.bidBubbleDefault')}</option>
          <option value={2000}>{t('settings.bidBubbleLong')}</option>
          <option value={3000}>{t('settings.bidBubbleVeryLong')}</option>
        </select>
      </label>
    </>
  );
}

function PlaySettings({ settings, update, t }: SectionProps) {
  const confirmLabel: Record<(typeof CONFIRM_MODES)[number], TranslationKey> = {
    auto: 'settings.confirmAuto',
    always: 'settings.confirmAlways',
    never: 'settings.confirmNever',
  };
  return (
    <>
      <fieldset className={styles.field}>
        <legend>{t('settings.confirm')}</legend>
        <SegmentedControl
          label={t('settings.confirm')}
          testId="setting-confirm"
          options={CONFIRM_MODES.map((mode) => ({ value: mode, label: t(confirmLabel[mode]) }))}
          value={settings.confirmPlay}
          onChange={(confirmPlay) => {
            update({ confirmPlay });
          }}
        />
      </fieldset>

      <fieldset className={styles.field}>
        <legend>{t('stats.scoring')}</legend>
        <SegmentedControl
          label={t('stats.scoring')}
          testId="setting-scoring"
          options={SCORING_MODES.map((mode) => ({
            value: mode,
            label: mode === 'seeger' ? t('stats.seeger') : t('stats.standard'),
          }))}
          value={settings.scoring}
          onChange={(scoring) => {
            update({ scoring });
          }}
        />
      </fieldset>
    </>
  );
}
