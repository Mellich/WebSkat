import { describe, expect, it } from 'vitest';
import type { CardId, Role } from '../../engine';
import {
  analysisInputFromView,
  analysisStart,
  encodeWorld,
  MAX_SAMPLES_PER_CARD,
  ROLLOUT_EPSILON,
  MIN_SAMPLES_TO_ELIMINATE,
  positionAt,
  viewFor,
  type AnalysisInput,
  type CardStat,
} from '../../table';
import { finishedTable } from '../../table/analysis/testing';
import { createRunner } from './runner';
import type { AnalyzeRequest, WorkerResponse } from './workerProtocol';

const ROLES: readonly Role[] = ['forehand', 'middlehand', 'hindhand'];

function inputOf(kind: 'played' | 'ramsch' | 'passed-in'): AnalysisInput {
  const input = analysisInputFromView(viewFor(finishedTable(kind), 'p0'));
  if (input === null) throw new Error('expected an input');
  return input;
}

/** A manual scheduler: steps wait in a queue until the test runs them. */
function manualQueue() {
  const queue: (() => void)[] = [];
  return {
    schedule: (step: () => void) => { queue.push(step); },
    runAll(n: number) {
      for (let i = 0; i < n; i++) {
        const step = queue.shift();
        if (step === undefined) break;
        step();
      }
    },
    pending: () => queue.length,
  };
}

function setup() {
  const posted: WorkerResponse[] = [];
  const queue = manualQueue();
  const runner = createRunner({
    post: (response) => { posted.push(response); },
    schedule: queue.schedule,
    seed: 7,
  });
  return { posted, queue, runner };
}

function analyze(id: number, input: AnalysisInput, plays: readonly CardId[] = [], initial: readonly CardStat[] | null = null): AnalyzeRequest {
  return { type: 'analyze', id, input, plays, useRealHands: false, epsilon: ROLLOUT_EPSILON, initial };
}

const played = inputOf('played');

/** The playable cards at the first card with `n` made-up worlds each (the fixture is a Null game: only wins decide). */
function fakeStats(input: AnalysisInput, n: number, outcome: (index: number) => { won: boolean; points: number }): CardStat[] {
  const start = analysisStart(input);
  if (!start.ok || start.value === null) throw new Error('expected a start state');
  const pos = positionAt(start.value, []);
  if (!pos.ok) throw new Error('expected a position');
  return pos.value.playable.map((card, index) => {
    const { won, points } = outcome(index);
    const worlds = Array.from({ length: n }, (_, i) => encodeWorld(won && i % 4 !== 0, points + (i % 3)));
    return { card, samples: n, wins: worlds.filter((w) => w % 2 === 1).length, points: worlds.reduce((a, w) => a + Math.floor(w / 2), 0), histogram: [], worlds };
  });
}

describe('createRunner adaptive sampling', () => {
  it('stops at once when one card is already clearly the best', () => {
    const { posted, queue, runner } = setup();
    const decided = fakeStats(played, MIN_SAMPLES_TO_ELIMINATE, (i) => (i === 0 ? { won: true, points: 80 } : { won: false, points: 20 }));
    runner.handle(analyze(1, played, [], decided));
    queue.runAll(3);
    expect(posted).toEqual([{ type: 'scores', id: 1, stats: decided, done: true }]);
    expect(queue.pending()).toBe(0);
  });

  it('keeps sampling only the cards that are not clearly behind', () => {
    const { posted, queue, runner } = setup();
    const stats = fakeStats(played, MIN_SAMPLES_TO_ELIMINATE, (i) => (i <= 1 ? { won: true, points: 60 } : { won: false, points: 20 }));
    runner.handle(analyze(1, played, [], stats));
    queue.runAll(1);
    const response = posted[0];
    if (response?.type !== 'scores') throw new Error('expected scores');
    expect(response.done).toBe(false);
    const counts = response.stats.map((s) => s.samples);
    expect(counts.filter((c) => c === MIN_SAMPLES_TO_ELIMINATE + 8)).toHaveLength(2);
    expect(counts.filter((c) => c === MIN_SAMPLES_TO_ELIMINATE)).toHaveLength(stats.length - 2);
  });
});

describe('createRunner epsilon', () => {
  it('plays the requested share of random moves: none makes real-hand samples identical', () => {
    const { posted, queue, runner } = setup();
    runner.handle({ ...analyze(1, played), useRealHands: true, epsilon: 0 });
    queue.runAll(1);
    const response = posted[0];
    if (response?.type !== 'scores') throw new Error('expected scores');
    expect(response.stats.every((s) => new Set(s.worlds).size === 1)).toBe(true);
  });
});

describe('createRunner', () => {
  it('posts the summed stats after every batch of 8 samples per card', () => {
    const { posted, queue, runner } = setup();
    runner.handle(analyze(1, played));
    queue.runAll(1);
    const first = posted[0];
    expect(first?.type).toBe('scores');
    if (first?.type !== 'scores') return;
    expect(first.id).toBe(1);
    expect(first.done).toBe(false);
    expect(first.stats.length).toBeGreaterThan(0);
    expect(first.stats.every((s) => s.samples === 8)).toBe(true);

    queue.runAll(2);
    const last = posted.at(-1);
    expect(last?.type === 'scores' && last.stats.every((s) => s.samples === 24)).toBe(true);
  });

  it('drops the steps of an older request', () => {
    const { posted, queue, runner } = setup();
    runner.handle(analyze(1, played));
    runner.handle(analyze(2, played));
    queue.runAll(2);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: 'scores', id: 2 });
  });

  it('stops at the next step after a stop request', () => {
    const { posted, queue, runner } = setup();
    runner.handle(analyze(1, played));
    runner.handle({ type: 'stop' });
    queue.runAll(5);
    expect(posted).toHaveLength(0);
    expect(queue.pending()).toBe(0);
  });

  it('continues from initial stats of the same cards', () => {
    const { posted, queue, runner } = setup();
    runner.handle(analyze(1, played));
    queue.runAll(1);
    const shown = posted[0];
    if (shown?.type !== 'scores') throw new Error('expected scores');

    const { posted: again, queue: queue2, runner: runner2 } = setup();
    runner2.handle(analyze(2, played, [], shown.stats));
    queue2.runAll(1);
    const resumed = again[0];
    expect(resumed?.type === 'scores' && resumed.stats.every((s) => s.samples === 16)).toBe(true);
  });

  it('starts at zero when the initial stats do not list the playable cards', () => {
    const { posted, queue, runner } = setup();
    const bogus: CardStat[] = [{ card: 'C7', samples: 800, wins: 0, points: 0, histogram: [], worlds: [] }];
    runner.handle(analyze(1, played, [], bogus));
    queue.runAll(1);
    const first = posted[0];
    expect(first?.type === 'scores' && first.stats.every((s) => s.samples === 8)).toBe(true);
  });

  it('reports done once every card has the maximum number of samples and stops scheduling', () => {
    const { posted, queue, runner } = setup();
    const first = (() => {
      const probe = setup();
      probe.runner.handle(analyze(1, played));
      probe.queue.runAll(1);
      const response = probe.posted[0];
      if (response?.type !== 'scores') throw new Error('expected scores');
      return response.stats;
    })();
    const nearMax: CardStat[] = first.map((s) => ({ ...s, samples: MAX_SAMPLES_PER_CARD - 8, wins: 0, points: 0, histogram: [], worlds: [] }));
    runner.handle(analyze(1, played, [], nearMax));
    queue.runAll(1);
    const last = posted[0];
    expect(last?.type === 'scores' && last.done).toBe(true);
    expect(queue.pending()).toBe(0);
  });

  it('posts an empty done result for Ramsch', () => {
    const { posted, queue, runner } = setup();
    runner.handle(analyze(1, inputOf('ramsch')));
    queue.runAll(3);
    expect(posted).toEqual([{ type: 'scores', id: 1, stats: [], done: true }]);
    expect(queue.pending()).toBe(0);
  });

  it('posts an empty done result at the end of the line', () => {
    const { posted, queue, runner } = setup();
    runner.handle(analyze(1, played, played.plays));
    queue.runAll(3);
    expect(posted).toEqual([{ type: 'scores', id: 1, stats: [], done: true }]);
    expect(queue.pending()).toBe(0);
  });

  it('posts an error for a card that is not legal at the cursor', () => {
    const { posted, queue, runner } = setup();
    const start = analysisStart(played);
    if (!start.ok || start.value === null) throw new Error('expected a start state');
    const playable = positionAt(start.value, []);
    if (!playable.ok) throw new Error('expected a position');
    const illegal = ROLES.flatMap((role) => played.hands[role]).find((c) => !playable.value.playable.includes(c));
    if (illegal === undefined) throw new Error('expected an illegal card');

    runner.handle(analyze(3, played, [illegal]));
    queue.runAll(3);
    expect(posted).toEqual([{ type: 'error', id: 3, message: 'ILLEGAL_CARD' }]);
  });

  it('posts an error for a passed-in game (nothing to replay)', () => {
    const { posted, runner } = setup();
    runner.handle(analyze(4, inputOf('passed-in')));
    expect(posted[0]).toMatchObject({ type: 'error', id: 4 });
  });
});
