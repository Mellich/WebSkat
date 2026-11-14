// Pure cursor moves of the replay (docs/plans/analysis/07 "State"). The line itself changes only
// through chooseCard (table/analysis); these functions never create a variant.

import type { CardId } from '../../engine';
import { divergenceAt, type AnalysisLine } from '../../table';

const CARDS_PER_TRICK = 3;

/** The line with the cursor at `cursor`, clamped to 0 … plays.length. */
export function moveTo(line: AnalysisLine, cursor: number): AnalysisLine {
  return { plays: line.plays, cursor: Math.min(line.plays.length, Math.max(0, cursor)) };
}

export function backOne(line: AnalysisLine): AnalysisLine {
  return moveTo(line, line.cursor - 1);
}

export function forwardOne(line: AnalysisLine): AnalysisLine {
  return moveTo(line, line.cursor + 1);
}

/** Forward is off at the end of the line (a variant continues only by choosing a card). */
export function canForward(line: AnalysisLine): boolean {
  return line.cursor < line.plays.length;
}

/** The end of trick `n` (1-based): after its third card. */
export function jumpToTrick(line: AnalysisLine, n: number): AnalysisLine {
  return moveTo(line, n * CARDS_PER_TRICK);
}

/** Back to the actual cards; the cursor stays where it was, or before the first variant card. */
export function resetToActual(actual: readonly CardId[], line: AnalysisLine): AnalysisLine {
  const divergence = divergenceAt(actual, line);
  if (divergence === null) return line;
  return { plays: actual, cursor: Math.min(line.cursor, divergence) };
}
