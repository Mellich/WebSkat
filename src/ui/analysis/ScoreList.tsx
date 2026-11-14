// The scores of the cards of the player to move, best first. A row is a button that plays the card.

import type { CardId, Declaration } from '../../engine';
import {
  averagePoints,
  CRITERIA,
  maxPoints,
  medianPoints,
  minPoints,
  winRate,
  type CardStat,
  type ScoreCriterion,
} from '../../table';
import { CardChip } from '../components/CardChip';
import { cardName } from '../game/labels';
import { cls } from '../classNames';
import { useT, type Translator } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { percent, points, rankStats } from './scoreFormat';
import styles from './ScoreList.module.css';

export interface ScoreListProps {
  readonly rows: readonly CardStat[]; // one per playable card (zeros before the first batch)
  readonly declaration: Declaration | null;
  readonly best: readonly CardId[]; // the best card, then the cards not clearly worse (about equal)
  readonly actualNext: CardId | null;
  readonly notice: TranslationKey | null; // shown instead of the rows (Ramsch, error)
  readonly criterion: ScoreCriterion; // what the best card is measured by
  readonly onCriterion: (criterion: ScoreCriterion) => void;
  readonly onChoose: (card: CardId) => void;
}

function marks(card: CardId, best: readonly CardId[], actualNext: CardId | null, t: Translator): string {
  const parts: string[] = [];
  if (card === actualNext) parts.push(t('analysis.played'));
  if (best.includes(card)) parts.push(t(best.length > 1 ? 'analysis.bestTied' : 'analysis.best'));
  return parts.join(' · ');
}

const CRITERION_LABEL: Record<ScoreCriterion, TranslationKey> = {
  win: 'analysis.winRate',
  average: 'analysis.avgPoints',
  median: 'analysis.medianPoints',
  max: 'analysis.maxPoints',
  min: 'analysis.minPoints',
};

export function ScoreList({ rows, declaration, best, actualNext, notice, criterion, onCriterion, onChoose }: ScoreListProps) {
  const t = useT();
  const hidePoints = declaration?.kind === 'null';
  const sampled = rows.some((r) => r.samples > 0);
  return (
    <section className={styles.scores} data-testid="analysis-scores">
      <h2>{t('analysis.scores')}</h2>
      {notice !== null ? <p className={styles.notice}>{t(notice)}</p> : (
        <>
          {hidePoints ? null : (
            <label className={styles.criterion}>
              {t('analysis.bestBy')}
              <select
                value={criterion}
                data-testid="analysis-criterion"
                onChange={(e) => {
                  const next = CRITERIA.find((c) => c === e.target.value);
                  if (next !== undefined) onCriterion(next);
                }}
              >
                {CRITERIA.map((c) => <option key={c} value={c}>{t(CRITERION_LABEL[c])}</option>)}
              </select>
            </label>
          )}
          {sampled ? null : <p className={styles.notice}>{t('analysis.calculating')}</p>}
          <ul className={styles.list}>
            <li className={cls(styles.row, styles.head)} aria-hidden="true">
              <span>{t('analysis.card')}</span>
              <span>{t('analysis.winRate')}</span>
              {hidePoints ? null : (
                <>
                  <span>{t('analysis.avgPoints')}</span>
                  <span>{t('analysis.medianPoints')}</span>
                  <span>{t('analysis.maxPoints')}</span>
                  <span>{t('analysis.minPoints')}</span>
                </>
              )}
              <span />
            </li>
            {rankStats(rows, hidePoints ? 'win' : criterion).map((stat) => {
              const rate = winRate(stat);
              return (
                <li key={stat.card}>
                  <button
                    type="button"
                    className={styles.row}
                    data-testid={`analysis-score-${stat.card}`}
                    aria-label={t('analysis.cardScore', { card: cardName(stat.card, t), percent: percent(rate) })}
                    onClick={() => { onChoose(stat.card); }}
                  >
                    <span><CardChip card={stat.card} /></span>
                    <span>{percent(rate)}</span>
                    {hidePoints ? null : (
                      <>
                        <span>{points(averagePoints(stat))}</span>
                        <span>{points(medianPoints(stat))}</span>
                        <span>{points(maxPoints(stat))}</span>
                        <span>{points(minPoints(stat))}</span>
                      </>
                    )}
                    <span className={styles.marks}>{marks(stat.card, best, actualNext, t)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
