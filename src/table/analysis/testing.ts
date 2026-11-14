// Test helpers: finished games from random play. Not exported from index.ts.

import { mulberry32 } from '../../engine';
import { applyCommand } from '../table';
import { ctxFor, playUntilRecords, tableWith } from '../testing';
import type { Ctx, PlayerId, TableCommand, TableState } from '../types';
import type { AnalysisKind } from './types';

function run(s: TableState, actor: PlayerId, c: TableCommand, seed: number): TableState {
  const result = applyCommand(s, actor, c, ctxFor(seed));
  if (!result.ok) throw new Error(`${c.type} rejected: ${result.error.code}`);
  return result.value.state;
}

/** A three-player table with Ramsch on when the kind needs it. */
export function startedTable(kind: AnalysisKind, seed: number): TableState {
  const withRules = kind === 'ramsch'
    ? run(tableWith(3), 'p0', { type: 'set-rules', rules: { ramsch: true, bock: false, kontra: false } }, seed)
    : tableWith(3);
  return run(withRules, 'p0', { type: 'start' }, seed);
}

/** The first table (seeds 1..) whose one finished game has the given kind. */
export function finishedTable(kind: AnalysisKind, maxSeeds = 300): TableState {
  for (let seed = 1; seed <= maxSeeds; seed++) {
    const ctxOf = (): Ctx => ctxFor(seed);
    const finished = playUntilRecords(startedTable(kind, seed), 1, ctxOf, mulberry32(seed));
    if (finished.game?.engine.result?.kind === kind) return finished;
  }
  throw new Error(`no ${kind} game within ${String(maxSeeds)} seeds`);
}
