// The end of a line that reached the end of the game: the result of a played or Ramsch game.

import { ROLES, type GameResult } from '../../engine';
import type { AnalysisInput } from '../../table';
import { declarationLabel } from '../game/labels';
import { useT } from '../i18n';
import styles from './AnalysisResult.module.css';

export interface AnalysisResultProps {
  readonly input: AnalysisInput;
  readonly result: GameResult;
}

export function AnalysisResult({ input, result }: AnalysisResultProps) {
  const t = useT();
  const names = input.names;
  return (
    <section className={styles.result} data-testid="analysis-result">
      <h2>{t('analysis.gameOver')}</h2>
      {result.kind === 'passed-in' ? <p>{t('result.passed')}</p> : null}
      {result.kind === 'played' ? (
        <>
          <p>
            {result.won
              ? t('result.won', { name: names[result.declarer], game: declarationLabel(result.declaration, t) })
              : t('result.lost', { name: names[result.declarer], game: declarationLabel(result.declaration, t) })}
          </p>
          {result.declaration.kind === 'null'
            ? <p>{t('result.nullValue', { value: result.gameValue })}</p>
            : <p>{t('result.points', { declarer: result.declarerPoints, defender: result.defenderPoints })}</p>}
          <p>{t('result.tricks', { declarer: result.declarerTricks, defender: result.defenderTricks })}</p>
          {result.multiplier === null
            ? null
            : <p>{t('result.calc', { base: result.base, multiplier: result.multiplier, value: result.gameValue })}</p>}
          {result.overbid ? <p>{t('result.overbid', { bid: result.bid, value: result.gameValue })}</p> : null}
        </>
      ) : null}
      {result.kind === 'ramsch' ? (
        <>
          {result.durchmarsch !== null
            ? <p>{t('result.durchmarsch', { name: names[result.durchmarsch] })}</p>
            : result.losers.length > 0
              ? <p>{t('result.ramschLost', { names: result.losers.map((r) => names[r]).join(', ') })}</p>
              : null}
          {result.jungfrau ? <p>{t('result.jungfrau')}</p> : null}
          <ul className={styles.rows}>
            {ROLES.map((role) => (
              <li key={role}>
                {t('analysis.ramschRow', {
                  name: names[role],
                  points: result.points[role],
                  tricks: result.tricks[role],
                  score: result.scores[role],
                })}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
