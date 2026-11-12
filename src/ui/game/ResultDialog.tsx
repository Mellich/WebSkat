// The end of a game: result, breakdown, revealed Skat, and "Continue" (docs/ui-game-screen.md §7).

import type { ReactNode } from 'react';

import type { GameRecord, TableView, ViewResult } from '../../table';
import { CardChips } from '../components/CardChip';
import { useT, type Translator } from '../i18n';
import { signed } from '../stats/gameLabel';
import { AllCards } from './AllCards';
import { declarationLabel } from './labels';
import { RamschResult } from './RamschResult';
import { namesById } from './seats';
import { revealedHands } from './revealedHands';
import styles from './ResultDialog.module.css';

export interface ResultDialogProps {
  readonly view: TableView;
  readonly result: ViewResult;
  /** The finished game's record, or null while it has not arrived yet. */
  readonly record: GameRecord | null;
  /** The scoring system chosen in Settings; the table shows its deltas. */
  readonly scoring: 'seeger' | 'standard';
  readonly onContinue: () => void;
  /** Host only: add a round after the last game of the series. */
  readonly onAddRounds: () => void;
}

export function ResultDialog({ view, result, record, scoring, onContinue, onAddRounds }: ResultDialogProps) {
  const t = useT();
  const names = namesById(view);
  const readyIds = new Set(view.table.readyIds);
  const waiting = view.table.players.filter((p) => !p.isBot && p.connected && !readyIds.has(p.id));
  const dealt = revealedHands(view);
  const shell = {
    t,
    onContinue,
    allCards: dealt === null ? null : <AllCards hands={dealt} />,
    onAddRounds: view.you.id === view.table.hostId ? onAddRounds : null,
    lastGame: view.table.gameLimit > 0 && view.table.gamesPlayed >= view.table.gameLimit,
    seats: view.table.players.length,
    iAmReady: readyIds.has(view.you.id),
    waiting: waiting.map((p) => p.name),
    // a passed-in game has no score to double, so it gets no Bock note
    record: result.kind === 'passed-in' ? null : record,
  };

  if (result.kind === 'passed-in') {
    return (
      <Shell {...shell}>
        <p>{t('result.passed')}</p>
      </Shell>
    );
  }
  if (result.kind === 'ramsch') {
    return (
      <Shell {...shell}>
        <RamschResult view={view} result={result} record={record} scoring={scoring} />
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
      {result.doubling === 2 ? <p>{t('result.kontra')}</p> : null}
      {result.doubling === 4 ? <p>{t('result.re')}</p> : null}
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
  readonly onAddRounds: (() => void) | null;
  readonly lastGame: boolean;
  readonly seats: number;
  readonly iAmReady: boolean;
  readonly waiting: readonly string[];
  readonly record: GameRecord | null;
  /** The "show all cards" button, or null while the game is not finished. */
  readonly allCards: ReactNode;
  readonly children: ReactNode;
}

function Shell({ t, onContinue, onAddRounds, lastGame, seats, iAmReady, waiting, record, allCards, children }: ShellProps) {
  const status = waiting.length > 0
    ? t('result.waitingFor', { names: waiting.join(', ') })
    : t('result.waitingOthers');
  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('result.title')} data-testid="result-dialog">
        <h2>{t('result.title')}</h2>
        {children}
        {record?.bock ? <p>{t('result.bock')}</p> : null}
        {record?.bockTriggered ? <p>{t('result.bockTriggered')}</p> : null}
        {allCards}
        {lastGame ? <p>{t('series.lastGame')}</p> : null}
        {iAmReady ? <p className={styles.waiting}>{status}</p> : null}
        {lastGame && onAddRounds !== null ? (
          <button type="button" onClick={onAddRounds} data-testid="add-rounds">{t('series.addRound', { games: seats })}</button>
        ) : null}
        <button type="button" onClick={onContinue} disabled={iAmReady} data-testid="continue">
          {lastGame ? t('series.finalStandings') : t('result.continue')}
        </button>
      </div>
    </div>
  );
}
