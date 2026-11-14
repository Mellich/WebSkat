// Test-only helpers for the analysis screen: finished-game inputs and a fake sampling worker.
// Not used by the app. The fake worker runs the real runner; its steps wait in a queue.

import { act } from '@testing-library/react';
import type { CardId } from '../../engine';
import {
  analysisInputFromView,
  analysisStart,
  positionAt,
  viewFor,
  type AnalysisInput,
  type Position,
} from '../../table';
import { finishedTable } from '../../table/analysis/testing';
import { createRunner } from './runner';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';
import type { WorkerFactory } from './useCardScores';

function inputFor(kind: 'played' | 'ramsch' | 'passed-in'): AnalysisInput {
  const input = analysisInputFromView(viewFor(finishedTable(kind), 'p0'));
  if (input === null) throw new Error(`expected a ${kind} input`);
  return input;
}

/** A finished played game (Grand, Suit or Null) from a fixed seed. */
export function playedInput(): AnalysisInput {
  return inputFor('played');
}

export function ramschInput(): AnalysisInput {
  return inputFor('ramsch');
}

export function passedInInput(): AnalysisInput {
  return inputFor('passed-in');
}

/** The position before the first card of `input` (played games only). */
export function startPosition(input: AnalysisInput): Position {
  const start = analysisStart(input);
  if (!start.ok || start.value === null) throw new Error('expected a started game');
  const position = positionAt(start.value, []);
  if (!position.ok) throw new Error('expected the first position');
  return position.value;
}

/** A playable card of the first position that is not the actual first card. */
export function otherFirstCard(input: AnalysisInput): CardId {
  const actual = input.plays[0];
  const other = startPosition(input).playable.find((c) => c !== actual);
  if (other === undefined) throw new Error('expected a second playable card');
  return other;
}

export interface FakeWorker {
  readonly factory: WorkerFactory;
  readonly sent: WorkerRequest[];
  /** How many times the worker was terminated. */
  terminated(): number;
  /** Runs up to `n` queued steps, each inside act() so React state updates are flushed. */
  drain(n?: number): void;
  pending(): number;
}

/** A fake worker built on the real runner (seed 3); steps run only when the test drains them. */
export function fakeWorker(): FakeWorker {
  const queue: (() => void)[] = [];
  const sent: WorkerRequest[] = [];
  let terminations = 0;
  const factory: WorkerFactory = (onResponse: (response: WorkerResponse) => void) => {
    const runner = createRunner({
      post: onResponse,
      schedule: (step) => { queue.push(step); },
      seed: 3,
    });
    return {
      send: (request) => {
        sent.push(request);
        runner.handle(request);
      },
      terminate: () => { terminations++; },
    };
  };
  const drain = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const step = queue.shift();
      if (step === undefined) return;
      act(() => { step(); });
    }
  };
  return { factory, sent, terminated: () => terminations, drain, pending: () => queue.length };
}
