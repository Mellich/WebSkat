// The tricks of the whole line: a click on trick n moves the cursor to its end. Tricks from the
// variant start on are marked as variant.

import type { CompletedTrick } from '../../engine';
import type { AnalysisInput } from '../../table';
import { CardChip } from '../components/CardChip';
import { cls } from '../classNames';
import { useT } from '../i18n';
import styles from './TrickHistory.module.css';

export interface TrickHistoryProps {
  readonly input: AnalysisInput;
  readonly tricks: readonly CompletedTrick[];
  readonly divergence: number | null; // first card index where the line leaves the actual game
  readonly onJump: (trickNo: number) => void; // 1-based
}

export function TrickHistory({ input, tricks, divergence, onJump }: TrickHistoryProps) {
  const t = useT();
  const variantStart = divergence === null ? null : Math.floor(divergence / 3) + 1;
  return (
    <section className={styles.history} data-testid="analysis-tricks">
      <h2>{t('analysis.tricks')}</h2>
      {tricks.length === 0 ? <p className={styles.empty}>{t('analysis.noTricks')}</p> : (
        <ol className={styles.list}>
          {tricks.map((trick, index) => {
            const trickNo = index + 1;
            const isVariant = variantStart !== null && trickNo >= variantStart;
            return (
              <li key={trickNo}>
                <button
                  type="button"
                  className={cls(styles.trick, isVariant && styles.variant)}
                  data-testid={`analysis-trick-${String(trickNo)}`}
                  onClick={() => { onJump(trickNo); }}
                >
                  <span className={styles.no}>{String(trickNo)}.</span>
                  {trick.plays.map((play) => (
                    <span key={play.card} className={styles.play}>
                      <CardChip card={play.card} /> {input.names[play.role]}
                    </span>
                  ))}
                  <span className={styles.winner}>{t('analysis.trickWinner', { name: input.names[trick.winner] })}</span>
                  {variantStart === trickNo ? <span className={styles.tag}>{t('analysis.variant', { trick: trickNo })}</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
