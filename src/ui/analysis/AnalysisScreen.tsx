// `#/analysis?g=…`: the game analysis in its own tab (docs/plans/analysis, docs/ui.md §11).
// Decodes the link once; a passed-in game shows the deal only, other games show the replay.

import { useMemo } from 'react';
import { analysisStart } from '../../table';
import { useT } from '../i18n';
import { AnalysisReplay } from './AnalysisReplay';
import { DealOverview } from './DealOverview';
import { decodeAnalysis } from './link';
import { summaryText } from './analysisSummary';
import type { WorkerFactory } from './useCardScores';
import styles from './AnalysisScreen.module.css';

export function AnalysisScreen({ data, workerFactory }: { readonly data: string | null; readonly workerFactory?: WorkerFactory | undefined }) {
  const t = useT();
  const input = useMemo(() => (data === null ? null : decodeAnalysis(data)), [data]);
  const start = useMemo(() => (input === null ? null : analysisStart(input)), [input]);
  if (input === null || start === null || !start.ok) {
    return (
      <main className={styles.screen}>
        <p data-testid="analysis-invalid">{t('analysis.invalid')}</p>
        <a href="#/">{t('analysis.home')}</a>
      </main>
    );
  }
  return (
    <main className={styles.screen} data-testid="analysis-screen">
      <header className={styles.head}>
        <h1>{t('analysis.title')}</h1>
        <a href="#/">{t('analysis.home')}</a>
      </header>
      <p className={styles.summary}>{summaryText(input, t)}</p>
      <DealOverview input={input} />
      {start.value === null ? null : <AnalysisReplay input={input} start={start.value} workerFactory={workerFactory} />}
    </main>
  );
}
