// Bars of the games by type (docs/statistics.md §3): how often each game was played and won.

import type { GameKindLabel, TableStats } from '../../table';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import styles from './StatsPanel.module.css';

const ORDER: readonly { readonly kind: GameKindLabel; readonly key: TranslationKey }[] = [
  { kind: 'clubs', key: 'game.clubs' },
  { kind: 'spades', key: 'game.spades' },
  { kind: 'hearts', key: 'game.hearts' },
  { kind: 'diamonds', key: 'game.diamonds' },
  { kind: 'grand', key: 'game.grand' },
  { kind: 'null', key: 'game.null' },
];

export function ByType({ byGame }: { readonly byGame: TableStats['byGame'] }) {
  const t = useT();
  const max = Math.max(1, ...ORDER.map((o) => byGame[o.kind].played));
  return (
    <ul className={styles.bars}>
      {ORDER.map((o) => {
        const entry = byGame[o.kind];
        return (
          <li key={o.kind}>
            <span className={styles.barLabel}>{t(o.key)}</span>
            <span className={styles.bar} style={{ width: `${String((entry.played / max) * 100)}%` }} aria-hidden="true" />
            <span>{entry.played} ({entry.declarerWon} won)</span>
          </li>
        );
      })}
    </ul>
  );
}
