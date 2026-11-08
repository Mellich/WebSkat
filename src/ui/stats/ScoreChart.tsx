// Cumulative score per player over the games, as a plain SVG line chart (docs/statistics.md §3).

import type { PlayerId, TableStats } from '../../table';
import { useT } from '../i18n';
import { chartPlots } from './chartGeometry';
import styles from './ScoreChart.module.css';

const COLORS = ['#f2c14e', '#4ade80', '#60a5fa', '#f87171', '#c084fc', '#2dd4bf'] as const;
const WIDTH = 360;
const HEIGHT = 200;
const MARGIN = 28;

export interface ScoreChartProps {
  readonly series: TableStats['series'];
  readonly players: readonly { readonly id: PlayerId; readonly name: string }[];
  readonly scoring: 'standard' | 'seeger';
}

export function ScoreChart({ series, players, scoring }: ScoreChartProps) {
  const t = useT();
  if (series.length === 0) return <p className={styles.empty}>{t('stats.empty')}</p>;
  const ids = players.map((p) => p.id);
  const { plots, min, max } = chartPlots(series, ids, scoring, { width: WIDTH, height: HEIGHT, margin: MARGIN });
  const zeroY = HEIGHT - MARGIN - ((0 - min) / (max - min === 0 ? 1 : max - min)) * (HEIGHT - 2 * MARGIN);
  const first = series[0]?.gameNumber ?? 1;
  const last = series.at(-1)?.gameNumber ?? first;

  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`} role="img" aria-label={t('stats.chartLabel')} className={styles.svg}>
        <line x1={MARGIN} x2={WIDTH - MARGIN} y1={zeroY} y2={zeroY} className={styles.zero} />
        <text x={MARGIN} y={HEIGHT - 6} className={styles.axis}>{t('stats.game')} {first}</text>
        <text x={WIDTH - MARGIN} y={HEIGHT - 6} textAnchor="end" className={styles.axis}>{last}</text>
        <text x={4} y={MARGIN} className={styles.axis}>{max}</text>
        <text x={4} y={HEIGHT - MARGIN} className={styles.axis}>{min}</text>
        {plots.map((plot, i) => (
          <polyline
            key={plot.playerId}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            points={plot.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          />
        ))}
      </svg>
      <figcaption className={styles.legend}>
        {players.map((p, i) => (
          <span key={p.id}>
            <span className={styles.swatch} style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
            {p.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
