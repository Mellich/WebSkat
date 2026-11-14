// The replay of the analysis: owns the line (cursor and variants), the switches and the sampling
// hook. Mounted only for played and Ramsch games (hooks cannot be conditional).

import { useMemo, useState, type KeyboardEvent } from 'react';
import type { CardId, GameState } from '../../engine';
import {
  actualLine,
  bestCards,
  chooseCard,
  divergenceAt,
  emptyStats,
  maxSamples,
  positionAt,
  ROLLOUT_EPSILON,
  type AnalysisInput,
  type AnalysisLine,
  type ScoreCriterion,
} from '../../table';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { AnalysisResult } from './AnalysisResult';
import { ReplayBoard } from './ReplayBoard';
import { ReplayControls } from './ReplayControls';
import { ScoreList } from './ScoreList';
import { TrickHistory } from './TrickHistory';
import { backOne, canForward, forwardOne, jumpToTrick, moveTo, resetToActual } from './lineNav';
import { useCardScores, type WorkerFactory } from './useCardScores';
import styles from './AnalysisReplay.module.css';

export interface AnalysisReplayProps {
  readonly input: AnalysisInput;
  readonly start: GameState; // the game at its first card (analysisStart)
  readonly workerFactory?: WorkerFactory | undefined; // tests pass a fake; the app uses the real worker
}

const CARDS_PER_TRICK = 3;

/** The key handler's move for one key, or null when the key is not a replay key. */
function moveFor(key: string, line: AnalysisLine): AnalysisLine | null {
  switch (key) {
    case 'ArrowLeft': return backOne(line);
    case 'ArrowRight': return canForward(line) ? forwardOne(line) : null;
    case 'Home': return moveTo(line, 0);
    case 'End': return moveTo(line, line.plays.length);
    default: return null;
  }
}

export function AnalysisReplay({ input, start, workerFactory }: AnalysisReplayProps) {
  const t = useT();
  const [line, setLine] = useState<AnalysisLine>(() => actualLine(input));
  const [useRealHands, setUseRealHands] = useState(false);
  const [paused, setPaused] = useState(false);
  const [epsilon, setEpsilon] = useState<number>(ROLLOUT_EPSILON);
  const [chosenCriterion, setCriterion] = useState<ScoreCriterion>('win');
  const applied = useMemo(() => line.plays.slice(0, line.cursor), [line]);
  const position = useMemo(() => positionAt(start, applied), [start, applied]);
  const whole = useMemo(() => positionAt(start, line.plays), [start, line.plays]);
  const scores = useCardScores(input, applied, useRealHands, paused, epsilon, workerFactory);

  if (!position.ok || !whole.ok) {
    return <p className={styles.error} role="alert">{t('analysis.error')}</p>;
  }
  const pos = position.value;
  const divergence = divergenceAt(input.plays, line);
  const scoring = input.kind === 'played' && pos.mover !== null;
  const rows = scores.stats.length > 0 ? scores.stats : emptyStats(pos);
  const criterion: ScoreCriterion = input.declaration?.kind === 'null' ? 'win' : chosenCriterion; // Null has no card points
  const best = bestCards(scores.stats, criterion);
  const top = best[0] ?? null; // what "play best" plays
  const actualNext: CardId | null = divergence === null || divergence >= line.cursor ? (input.plays[line.cursor] ?? null) : null;
  const notice: TranslationKey | null = input.kind === 'ramsch'
    ? 'analysis.noScoresRamsch'
    : scores.error === null ? null : 'analysis.error';
  const status = pos.mover === null
    ? t('analysis.gameOver')
    : t('analysis.position', { trick: Math.floor(line.cursor / CARDS_PER_TRICK) + 1, card: (line.cursor % CARDS_PER_TRICK) + 1 });

  const go = (next: AnalysisLine) => { setLine(next); };
  const choose = (card: CardId) => { setLine(chooseCard(line, card)); };

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    const next = moveFor(e.key, line);
    if (next === null) return;
    e.preventDefault();
    go(next);
  }

  return (
    <div className={styles.replay} tabIndex={-1} onKeyDown={onKeyDown}>
      <section className={styles.stage}>
        <h2>{t('analysis.replay')}</h2>
        <div className={styles.columns}>
          <ReplayBoard
            input={input}
            position={pos}
            stats={scores.stats}
            best={best}
            actualNext={actualNext}
            onChoose={choose}
          />
          <div className={styles.side}>
            <ReplayControls
              cursor={line.cursor}
              length={line.plays.length}
              canForward={canForward(line)}
              status={status}
              variantTrick={divergence === null ? null : Math.floor(divergence / CARDS_PER_TRICK) + 1}
              scoring={scoring}
              canPlayBest={top !== null}
              useRealHands={useRealHands}
              epsilon={epsilon}
              paused={paused}
              samples={maxSamples(rows)}
              done={scores.done}
              onStart={() => { go(moveTo(line, 0)); }}
              onBack={() => { go(backOne(line)); }}
              onForward={() => { go(forwardOne(line)); }}
              onEnd={() => { go(moveTo(line, line.plays.length)); }}
              onPlayBest={() => { if (top !== null) choose(top); }}
              onReset={() => { go(resetToActual(input.plays, line)); }}
              onRealHands={setUseRealHands}
              onEpsilon={setEpsilon}
              onTogglePause={() => { setPaused((p) => !p); }}
            />
            {pos.result !== null
              ? <AnalysisResult input={input} result={pos.result} />
              : (
                <ScoreList
                  rows={rows}
                  declaration={input.declaration}
                  best={best}
                  actualNext={actualNext}
                  notice={notice}
                  criterion={criterion}
                  onCriterion={setCriterion}
                  onChoose={choose}
                />
              )}
          </div>
        </div>
      </section>
      <TrickHistory
        input={input}
        tricks={whole.value.tricks}
        divergence={divergence}
        onJump={(n) => { go(jumpToTrick(line, n)); }}
      />
    </div>
  );
}
