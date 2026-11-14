// The sampling loop of the analysis worker, without the worker itself (docs/plans/analysis/06).
// Each batch adds SAMPLES_PER_BATCH worlds per card; the summed stats are posted after every batch.

import { mulberry32 } from '../../engine';
import {
  activeCards,
  analysisStart,
  canScore,
  emptyStats,
  positionAt,
  SAMPLES_PER_BATCH,
  scoreBatch,
  type CardStat,
  type Position,
} from '../../table';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

export interface RunnerDeps {
  readonly post: (response: WorkerResponse) => void;
  readonly schedule: (step: () => void) => void; // the worker passes (f) => setTimeout(f, 0)
  readonly seed: number;
}

export interface Runner {
  handle(request: WorkerRequest): void;
}

interface Current {
  readonly id: number;
  readonly position: Position;
  readonly stats: readonly CardStat[];
  readonly useRealHands: boolean;
  readonly epsilon: number;
  readonly usePoints: boolean; // card points matter (not for Null)
  readonly rand: () => number;
}

/** The stats to continue from when they list exactly the playable cards; zeroed stats otherwise. */
function startStats(position: Position, initial: readonly CardStat[] | null): readonly CardStat[] {
  if (initial === null) return emptyStats(position);
  const listed = new Set(initial.map((s) => s.card));
  const same = initial.length === position.playable.length && position.playable.every((c) => listed.has(c));
  return same ? initial : emptyStats(position);
}

export function createRunner(deps: RunnerDeps): Runner {
  let current: Current | null = null;

  function runStep(id: number): void {
    if (current === null || current.id !== id) return;
    const { position, stats, useRealHands, epsilon, usePoints, rand } = current;
    const active = activeCards(stats, usePoints);
    if (active.length === 0) { // resumed after the analysis was finished
      deps.post({ type: 'scores', id, stats, done: true });
      current = null;
      return;
    }
    let next: readonly CardStat[];
    try {
      next = scoreBatch(position, stats, { useRealHands, epsilon, samples: SAMPLES_PER_BATCH, cards: active }, rand);
    } catch (error) {
      current = null;
      deps.post({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
      return;
    }
    const done = activeCards(next, usePoints).length === 0;
    current = { ...current, stats: next };
    deps.post({ type: 'scores', id, stats: next, done });
    if (done) current = null;
    else deps.schedule(() => { runStep(id); });
  }

  function analyze(request: Extract<WorkerRequest, { type: 'analyze' }>): void {
    const { id, input, plays, useRealHands, epsilon, initial } = request;
    const start = analysisStart(input);
    if (!start.ok || start.value === null) {
      current = null;
      deps.post({ type: 'error', id, message: start.ok ? 'PASSED_IN' : start.error.code });
      return;
    }
    const position = positionAt(start.value, plays);
    if (!position.ok) {
      current = null;
      deps.post({ type: 'error', id, message: position.error.code });
      return;
    }
    if (!canScore(position.value)) {
      current = null;
      deps.post({ type: 'scores', id, stats: [], done: true });
      return;
    }
    current = {
      id,
      position: position.value,
      stats: startStats(position.value, initial),
      useRealHands,
      epsilon,
      usePoints: start.value.declaration?.kind !== 'null',
      rand: mulberry32((deps.seed ^ id) >>> 0),
    };
    deps.schedule(() => { runStep(id); });
  }

  return {
    handle(request: WorkerRequest): void {
      if (request.type === 'stop') current = null;
      else analyze(request);
    },
  };
}
