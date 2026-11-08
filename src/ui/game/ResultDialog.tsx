// The end of a game: result, breakdown, revealed Skat, and "Continue" (docs/ui-game-screen.md §7).

import type { ReactNode } from 'react';

import type { GameRecord, TableView, ViewResult } from '../../table';
import { CardChips } from '../components/CardChip';
import { useT, type Translator } from '../i18n';
import { signed } from '../stats/gameLabel';
import { declarationLabel } from './labels';
import { namesById } from './seats';
import styles from './ResultDialog.module.css';

export interface ResultDialogProps {
  readonly view: TableView;
  readonly result: ViewResult;
  /** The finished game's record, or null while it has not arrived yet. */
  readonly record: GameRecord | null;
  /** The scoring system chosen in Settings; the table shows its deltas. */
  readonly scoring: 'seeger' | 'standard';
  readonly onContinue: () => void;
}

export function ResultDialog({ view, result, record, scoring, onContinue }: ResultDialogProps) {
  const t = useT();
  const names = namesById(view);
  const readyIds = new Set(view.table.readyIds);
  const waiting = view.table.players.filter((p) => !p.isBot && p.connected && !readyIds.has(p.id));
  const shell = {
    t,
    onContinue,
    iAmReady: readyIds.has(view.you.id),
    waiting: waiting.map((p) => p.name),
  };

  if (result.kind === 'passed-in') {
    return (
      <Shell {...shell}>
        <p>{t('result.passed')}</p>
      </Shell>
    );
  }

  const declarer = names.get(result.declarerId) ?? '?';
  const gameText = declarationLabel(result.declaration, t);
  const headline = result.won
    ? t('result.won', { name: declarer, game: gameText })
    : t('result.lost', { name: declarer, game: gameText });
  const game = view.game;

  return (
    <Shell {...shell}>
      <p className={styles.headline}>{headline}</p>
      {result.overbid ? <p>{t('result.overbid', { bid: result.bid, value: result.gameValue })}</p> : null}
      {result.declaration.kind === 'null' ? (
        <p>{t('result.nullValue', { value: result.gameValue })}</p>
      ) : (
        <p>{t('result.calc', { base: result.base, multiplier: result.multiplier ?? 0, value: result.gameValue })}</p>
      )}
      <p>{t('result.points', { declarer: result.declarerPoints, defender: result.defenderPoints })}</p>
      <p>{t('result.tricks', { declarer: result.declarerTricks, defender: result.defenderTricks })}</p>
      {game?.skat === null || game?.skat === undefined ? null : (
        <p>{t('result.skat')}: <CardChips cards={game.skat} /></p>
      )}
      {game?.discarded === null || game?.discarded === undefined || game.discarded.length === 0 ? null : (
        <p>{t('result.discarded')}: <CardChips cards={game.discarded} /></p>
      )}
      <table className={styles.table}>
        <caption>{t('result.changeIn', { system: scoring === 'seeger' ? t('stats.seeger') : t('stats.standard') })}</caption>
        <tbody>
          {view.table.players.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{record === null ? '…' : signed(record.scores[scoring][p.id] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}

interface ShellProps {
  readonly t: Translator;
  readonly onContinue: () => void;
  readonly iAmReady: boolean;
  readonly waiting: readonly string[];
  readonly children: ReactNode;
}

function Shell({ t, onContinue, iAmReady, waiting, children }: ShellProps) {
  const status = waiting.length > 0
    ? t('result.waitingFor', { names: waiting.join(', ') })
    : t('result.waitingOthers');
  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('result.title')} data-testid="result-dialog">
        <h2>{t('result.title')}</h2>
        {children}
        {iAmReady ? <p className={styles.waiting}>{status}</p> : null}
        <button type="button" onClick={onContinue} disabled={iAmReady} data-testid="continue">{t('result.continue')}</button>
      </div>
    </div>
  );
}
