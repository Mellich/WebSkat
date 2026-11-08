// Host: pick who takes a seat (a waiting player or a bot) for `replace-player`.

import { useState } from 'react';
import type { BotLevel, PlayerPublic, ReplaceBy } from '../../table';
import { useT } from '../i18n';
import styles from './PlayersDialog.module.css';

/** Option value for "a new bot"; player ids never have this value. */
const BOT = 'bot';
const LEVELS: readonly BotLevel[] = ['easy', 'normal', 'strong'];
const LEVEL_KEYS = { easy: 'botLevel.easy', normal: 'botLevel.normal', strong: 'botLevel.strong' } as const;

export interface ReplaceChooserProps {
  readonly name: string;
  readonly waiting: readonly PlayerPublic[];
  readonly onConfirm: (by: ReplaceBy) => void;
  readonly onCancel: () => void;
}

export function ReplaceChooser({ name, waiting, onConfirm, onCancel }: ReplaceChooserProps) {
  const t = useT();
  const options = [
    ...waiting.map((p) => ({ value: p.id, label: p.name })),
    { value: BOT, label: t('players.bot') },
  ];
  const [choice, setChoice] = useState(options[0]?.value ?? BOT);
  const [level, setLevel] = useState<BotLevel>('normal');
  return (
    <div className={styles.chooser}>
      <label className={styles.chooserField}>
        <span>{t('players.replaceWith', { name })}</span>
        <select
          value={choice}
          data-testid="replace-with"
          onChange={(e) => {
            setChoice(e.target.value);
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      {choice === BOT ? (
        <label className={styles.chooserField}>
          <span>{t('players.botLevel')}</span>
          <select
            value={level}
            data-testid="replace-level"
            onChange={(e) => {
              const picked = LEVELS.find((l) => l === e.target.value);
              if (picked !== undefined) setLevel(picked);
            }}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>{t(LEVEL_KEYS[l])}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className={styles.controls}>
        <button
          type="button"
          data-testid="replace-confirm"
          onClick={() => {
            onConfirm(choice === BOT ? { kind: 'bot', level } : { kind: 'pending', playerId: choice });
          }}
        >
          {t('players.confirm')}
        </button>
        <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}
