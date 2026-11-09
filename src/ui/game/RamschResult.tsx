// The result of a Ramsch inside the result dialog: headline, Jungfrau note, card points and the
// score change per player, and the Skat (visible to everybody after a Ramsch; skat-rules §12).

import type { GameRecord, TableView, ViewResult } from '../../table';
import { CardChips } from '../components/CardChip';
import { useT } from '../i18n';
import { signed } from '../stats/gameLabel';
import { namesById } from './seats';
import styles from './ResultDialog.module.css';

export type RamschViewResult = Extract<ViewResult, { kind: 'ramsch' }>;

export interface RamschResultProps {
  readonly view: TableView;
  readonly result: RamschViewResult;
  /** The finished game's record, or null while it has not arrived yet. */
  readonly record: GameRecord | null;
  readonly scoring: 'seeger' | 'standard';
}

export function RamschResult({ view, result, record, scoring }: RamschResultProps) {
  const t = useT();
  const names = namesById(view);
  const nameOf = (id: string): string => names.get(id) ?? '?';
  const headline = result.durchmarschId === null
    ? t('result.ramschLost', { names: result.loserIds.map(nameOf).join(', ') })
    : t('result.durchmarsch', { name: nameOf(result.durchmarschId) });
  const skat = view.game?.skat ?? null;

  return (
    <>
      <p className={styles.headline}>{headline}</p>
      {result.jungfrau ? <p>{t('result.jungfrau')}</p> : null}
      <table className={styles.table}>
        <caption>{t('result.changeIn', { system: scoring === 'seeger' ? t('stats.seeger') : t('stats.standard') })}</caption>
        <tbody>
          {view.table.players.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{String(result.points[p.id] ?? 0)}</td>
              <td>{record === null ? '…' : signed(record.scores[scoring][p.id] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {skat === null ? null : <p>{t('result.skat')}: <CardChips cards={skat} /></p>}
    </>
  );
}
