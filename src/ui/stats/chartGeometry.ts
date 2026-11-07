// Geometry of the score chart (pure, so it can be tested). Each series point is one game.

import type { PlayerId, TableStats } from '../../table';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Plot {
  readonly playerId: PlayerId;
  readonly points: readonly Point[];
}

export interface ChartBox {
  readonly width: number;
  readonly height: number;
  readonly margin: number;
}

/** One polyline per player over the series; the value range always includes zero. */
export function chartPlots(
  series: TableStats['series'],
  playerIds: readonly PlayerId[],
  scoring: 'standard' | 'seeger',
  box: ChartBox,
): { readonly plots: readonly Plot[]; readonly min: number; readonly max: number } {
  const values = series.flatMap((s) => playerIds.map((id) => s.cumulative[id]?.[scoring] ?? 0));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min === 0 ? 1 : max - min;
  const inner = { w: box.width - 2 * box.margin, h: box.height - 2 * box.margin };
  const x = (i: number): number =>
    box.margin + (series.length <= 1 ? inner.w / 2 : (i / (series.length - 1)) * inner.w);
  const y = (v: number): number => box.margin + (1 - (v - min) / span) * inner.h;
  const plots = playerIds.map((id) => ({
    playerId: id,
    points: series.map((s, i) => ({ x: x(i), y: y(s.cumulative[id]?.[scoring] ?? 0) })),
  }));
  return { plots, min, max };
}
