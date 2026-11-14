// The Monte-Carlo card scores of the analysis screen, sampled continuously in a Web Worker
// (docs/plans/analysis/06, docs/ui.md "Analysis screen", decision I185).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardId } from '../../engine';
import type { AnalysisInput, CardStat } from '../../table';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

export interface WorkerHandle {
  send(request: WorkerRequest): void;
  terminate(): void;
}

export type WorkerFactory = (onResponse: (response: WorkerResponse) => void) => WorkerHandle;

/** The real worker. Only called in the browser. */
export const defaultWorkerFactory: WorkerFactory = (onResponse) => {
  const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => { onResponse(e.data); });
  return {
    send: (request) => { worker.postMessage(request); },
    terminate: () => { worker.terminate(); },
  };
};

export interface CardScores {
  readonly stats: readonly CardStat[]; // [] while nothing has arrived for the current position
  readonly done: boolean;
  readonly error: string | null;
}

/** What the screen shows, with the position key it belongs to. */
interface Shown extends CardScores {
  readonly key: string | null;
}

const NOTHING: Shown = { key: null, stats: [], done: false, error: null };

/**
 * Scores of the playable cards at the end of `plays`. `input` must be a stable object (memoized by
 * the caller): a new identity restarts the sampling (resuming from the shown stats).
 */
export function useCardScores(
  input: AnalysisInput,
  plays: readonly CardId[],
  useRealHands: boolean,
  paused: boolean,
  epsilon: number,
  factory: WorkerFactory = defaultWorkerFactory,
): CardScores {
  const positionKey = `${plays.join(',')}|${useRealHands ? 'real' : 'sampled'}|${String(epsilon)}`;
  const [shown, setShown] = useState<Shown>(NOTHING);
  const shownRef = useRef<Shown>(NOTHING);
  const handleRef = useRef<WorkerHandle | null>(null);
  const idRef = useRef(0);
  const keyRef = useRef('');
  const playsRef = useRef(plays);

  const publish = useCallback((next: Shown) => {
    shownRef.current = next;
    setShown(next);
  }, []);

  // Keeps the latest line for the effect below; the effect itself depends on the key only.
  useEffect(() => { playsRef.current = plays; });

  // One worker per mounted screen.
  useEffect(() => {
    const handle = factory((response) => {
      if (response.id !== idRef.current) return;
      if (response.type === 'error') {
        publish({ key: keyRef.current, stats: [], done: false, error: response.message });
      } else {
        publish({ key: keyRef.current, stats: response.stats, done: response.done, error: null });
      }
    });
    handleRef.current = handle;
    return () => {
      handle.terminate();
      handleRef.current = null;
    };
  }, [factory, publish]);

  // Every change of position, pause or switch starts a new request. Older answers carry older ids.
  useEffect(() => {
    const handle = handleRef.current;
    if (handle === null) return;
    idRef.current += 1;
    keyRef.current = positionKey;
    const resume = shownRef.current.key === positionKey;
    if (!resume) publish({ key: positionKey, stats: [], done: false, error: null });
    if (paused) {
      handle.send({ type: 'stop' });
      return;
    }
    handle.send({
      type: 'analyze',
      id: idRef.current,
      input,
      plays: playsRef.current,
      useRealHands,
      epsilon,
      initial: resume ? shownRef.current.stats : null,
    });
  }, [input, positionKey, useRealHands, paused, epsilon, publish]);

  const current = shown.key === positionKey ? shown : NOTHING;
  return { stats: current.stats, done: current.done, error: current.error };
}
