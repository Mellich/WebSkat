# Step 06: continuous sampling in a Web Worker

**Kind:** feature. **Layers:** ui. **Protocol:** no. **Needs:** steps 04 and 05.

## Read first

- `src/ui/AGENTS.md`, `docs/dev/testing.md` (fake timers, jsdom pragma, no jest-dom)
- `src/table/analysis/scores.ts` and `replay.ts` (steps 03, 04)
- Vite worker syntax: `new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })`
  is built in (no plugin, no dependency).

## Why

One batch (8 worlds × up to 10 cards ≈ 80 play-outs) takes roughly 30–60 ms. Running batches
without pause on the main thread would freeze the page, so the sampling runs in a module Web
Worker and posts the summed stats after every batch. The loop logic lives in a plain module
(`runner.ts`) that is unit-tested without a real worker.

## Files

### `src/ui/analysis/workerProtocol.ts`

```ts
// Messages between the analysis screen and its sampling worker (same origin, not network data).

export interface AnalyzeRequest {
  readonly type: 'analyze';
  readonly id: number; // increases with every request; older answers are dropped
  readonly input: AnalysisInput;
  readonly plays: readonly CardId[]; // the line up to the cursor
  readonly useRealHands: boolean;
  /** Stats to continue from (resume after pause of the same position); null = start at zero. */
  readonly initial: readonly CardStat[] | null;
}
export interface StopRequest {
  readonly type: 'stop';
}
export type WorkerRequest = AnalyzeRequest | StopRequest;

export type WorkerResponse =
  | { readonly type: 'scores'; readonly id: number; readonly stats: readonly CardStat[]; readonly done: boolean }
  | { readonly type: 'error'; readonly id: number; readonly message: string };
```

The messages never leave the browser tab, so they are typed but not zod-validated (the input was
validated when the link was decoded). Mention this in the decision row "Continuous sampling".

### `src/ui/analysis/runner.ts`

```ts
export interface RunnerDeps {
  readonly post: (response: WorkerResponse) => void;
  readonly schedule: (step: () => void) => void; // the worker passes (f) => setTimeout(f, 0)
  readonly seed: number;
}
export interface Runner {
  handle(request: WorkerRequest): void;
}
export function createRunner(deps: RunnerDeps): Runner;
```

Behaviour:

- Keeps `current: { id, position, stats, useRealHands, rand } | null`.
- `stop`: `current = null` (a scheduled step sees that and does nothing).
- `analyze`: `analysisStart(input)` and `positionAt(start, plays)`; on error or `start === null`
  post `{ type: 'error', id, message }` (message = the error code) and set `current = null`.
  If `!canScore(position)`: post `{ type: 'scores', id, stats: [], done: true }` and stop.
  Else `stats = initial ?? emptyStats(position)` (if `initial` does not list exactly the playable
  cards, use `emptyStats`), `rand = mulberry32((deps.seed ^ id) >>> 0)`, then `schedule(step)`.
- `step`: if `current` is null or its id changed since scheduling, return. Run
  `scoreBatch(position, stats, { useRealHands, samples: SAMPLES_PER_BATCH }, rand)` inside
  `try/catch` (post `error` on exception). Post `scores` with
  `done = minSamples(stats) >= MAX_SAMPLES_PER_CARD`. If not done, `schedule(step)`.

### `src/ui/analysis/analysis.worker.ts`

```ts
// The analysis sampling worker: runs createRunner on messages from the analysis screen.
import { createRunner } from './runner';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

const runner = createRunner({
  post: (response: WorkerResponse) => { self.postMessage(response); },
  schedule: (step) => { setTimeout(step, 0); },
  seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
});
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => { runner.handle(event.data); });
```

Type notes: `tsconfig.app.json` has the DOM lib, so `self` is typed as `Window`.
`self.postMessage(message)` compiles (the `options` argument is optional) and
`MessageEvent<WorkerRequest>` avoids `any`. Do **not** add the `WebWorker` lib (it conflicts with
DOM). If ESLint still flags something, fix the types; never disable a rule.

### `src/ui/analysis/useCardScores.ts`

```ts
export interface WorkerHandle {
  send(request: WorkerRequest): void;
  terminate(): void;
}
export type WorkerFactory = (onResponse: (response: WorkerResponse) => void) => WorkerHandle;

/** The real worker. Only called in the browser. */
export const defaultWorkerFactory: WorkerFactory = (onResponse) => {
  const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => { onResponse(e.data); });
  return { send: (r) => { worker.postMessage(r); }, terminate: () => { worker.terminate(); } };
};

export interface CardScores {
  readonly stats: readonly CardStat[]; // [] while nothing has arrived for the current position
  readonly done: boolean;
  readonly error: string | null;
}

export function useCardScores(
  input: AnalysisInput,
  plays: readonly CardId[], // line up to the cursor
  useRealHands: boolean,
  paused: boolean,
  factory: WorkerFactory = defaultWorkerFactory,
): CardScores;
```

Behaviour:

- Create the worker once in a `useEffect` (`factory(onResponse)`), `terminate()` in its cleanup.
  Keep the handle in a `useRef`.
- A second effect depends on `[input, playsKey, useRealHands, paused]` where
  `playsKey = plays.join(',')` (stable string; arrays change identity on every render).
  - `paused` → `send({ type: 'stop' })`, keep the shown stats.
  - else `id = ++idRef.current`; `initial` = the shown stats **only if** the position key
    (`playsKey` + `useRealHands`) equals the key of those stats (resume), else `null` and reset the
    shown stats to `[]`; `send({ type: 'analyze', id, input, plays, useRealHands, initial })`.
- `onResponse`: ignore responses whose `id !== idRef.current`; store `stats`/`done` or `error`
  in state (one `useState` holding `{ key, stats, done, error }`).
- The worker handle must exist before the second effect sends; order the effects accordingly or
  create the handle lazily in the second effect.

## Tests first

`src/ui/analysis/runner.test.ts` (node env). A manual scheduler: `const queue: (() => void)[] = []`,
`schedule = (f) => queue.push(f)`, `runAll(n)` runs up to n queued steps.

1. `analyze` at the first card → after one step a `scores` message with `samples === 8` per card;
   after three steps `24`.
2. A second `analyze` with a higher id: steps queued for the old id post nothing.
3. `stop` → queued steps post nothing.
4. `initial` stats for the same cards → the first post has `initial.samples + 8`.
5. `done`: pass `initial` stats with `samples = MAX_SAMPLES_PER_CARD - 8` for every card (wins and
   points 0) and expect `done: true` after one step and an empty queue afterwards.
6. Ramsch input or the end of the line → one `scores` message with `stats: []`, `done: true`.
7. Invalid plays (a card not legal) → an `error` message.

`src/ui/analysis/useCardScores.test.tsx` (jsdom). Fake factory built on `createRunner` with the
manual queue (so the real sampling runs synchronously when the test drains the queue):

1. Mount → one `analyze` request; draining one step → `stats` with 8 samples per card.
2. Change `plays` → a new `analyze` with a higher id and `initial: null`; old responses ignored;
   shown stats reset to `[]` until the new position answers.
3. `paused` true → a `stop` request; set back to false → `analyze` with `initial` = shown stats.
4. Unmount → `terminate` called.

Wrap state-changing drains in `act(...)`.

Run: `npx vitest run src/ui/analysis`

## Docs

- `docs/ui.md`: new section "Analysis screen" (filled in step 07) – start it here with the
  worker paragraph: runner, batches, cap, pause/resume, ids.
- `src/ui/AGENTS.md` file map: `workerProtocol.ts`, `runner.ts`, `analysis.worker.ts`,
  `useCardScores.ts`.
- `docs/decisions.md`: row "Continuous sampling" (README §3).

## Done when

`npm run check` is green; `npm run build` produces a separate worker chunk (look for
`analysis.worker` in `dist/assets`).
