// Replay buttons, the status line, the variant badge with "Back to the actual game", and the
// sampling controls (real-hands switch, play best, pause). Only the parent decides what is enabled.

import { ROLLOUT_EPSILONS } from '../../table';
import { Switch } from '../components/Switch';
import { useT } from '../i18n';
import styles from './ReplayControls.module.css';

export interface ReplayControlsProps {
  readonly cursor: number;
  readonly length: number; // plays in the line
  readonly canForward: boolean;
  readonly status: string;
  readonly variantTrick: number | null; // 1-based trick where the line left the actual game
  readonly scoring: boolean; // a played game with a player to move: sampling controls are shown
  readonly canPlayBest: boolean;
  readonly useRealHands: boolean;
  readonly epsilon: number; // share of random moves in the play-outs
  readonly paused: boolean;
  readonly samples: number; // largest sample count over the cards (cards that are clearly behind stop earlier)
  readonly done: boolean;
  readonly onStart: () => void;
  readonly onBack: () => void;
  readonly onForward: () => void;
  readonly onEnd: () => void;
  readonly onPlayBest: () => void;
  readonly onReset: () => void;
  readonly onRealHands: (on: boolean) => void;
  readonly onEpsilon: (epsilon: number) => void;
  readonly onTogglePause: () => void;
}

export function ReplayControls(props: ReplayControlsProps) {
  const t = useT();
  const { cursor, length, canForward, status, variantTrick, scoring, canPlayBest } = props;
  return (
    <div className={styles.controls} role="group" aria-label={t('analysis.controls')}>
      <div className={styles.nav}>
        <button type="button" className={styles.step} data-testid="analysis-start" aria-label={t('analysis.start')} title={t('analysis.start')} disabled={cursor === 0} onClick={props.onStart}>|◀</button>
        <button type="button" className={styles.step} data-testid="analysis-back" aria-label={t('analysis.back')} title={t('analysis.back')} disabled={cursor === 0} onClick={props.onBack}>◀</button>
        <button type="button" className={styles.step} data-testid="analysis-forward" aria-label={t('analysis.forward')} title={t('analysis.forward')} disabled={!canForward} onClick={props.onForward}>▶</button>
        <button type="button" className={styles.step} data-testid="analysis-end" aria-label={t('analysis.end')} title={t('analysis.end')} disabled={cursor === length} onClick={props.onEnd}>▶|</button>
      </div>
      <p className={styles.status} data-testid="analysis-status" aria-live="polite">{status}</p>
      {variantTrick === null ? null : (
        <div className={styles.variant}>
          <span className={styles.badge} data-testid="analysis-variant">{t('analysis.variant', { trick: variantTrick })}</span>
          <button type="button" className={styles.button} data-testid="analysis-reset" onClick={props.onReset}>{t('analysis.reset')}</button>
        </div>
      )}
      {scoring ? (
        <div className={styles.sampling}>
          <Switch checked={props.useRealHands} onChange={props.onRealHands} testId="analysis-real-hands">
            {t('analysis.realHands')}
          </Switch>
          <p className={styles.hint}>{t('analysis.realHandsHint')}</p>
          <label className={styles.field}>
            {t('analysis.epsilon')}
            <select
              value={String(props.epsilon)}
              data-testid="analysis-epsilon"
              onChange={(e) => {
                const next = ROLLOUT_EPSILONS.find((x) => String(x) === e.target.value);
                if (next !== undefined) props.onEpsilon(next);
              }}
            >
              {ROLLOUT_EPSILONS.map((x) => <option key={x} value={String(x)}>{`${String(Math.round(x * 100))} %`}</option>)}
            </select>
          </label>
          <p className={styles.hint}>{t('analysis.epsilonHint')}</p>
          <div className={styles.row}>
            <button type="button" className={styles.button} data-testid="analysis-play-best" disabled={!canPlayBest} onClick={props.onPlayBest}>{t('analysis.playBest')}</button>
            <button type="button" className={styles.button} data-testid="analysis-pause" onClick={props.onTogglePause}>{props.paused ? t('analysis.resume') : t('analysis.pause')}</button>
          </div>
          <p className={styles.hint}>{props.done ? t('analysis.finished', { count: props.samples }) : t('analysis.samples', { count: props.samples })}</p>
        </div>
      ) : null}
    </div>
  );
}
