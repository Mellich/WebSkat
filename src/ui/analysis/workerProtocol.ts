// Messages between the analysis screen and its sampling worker (same origin, not network data).
// The messages never leave the browser tab, so they are typed but not zod-validated: the input
// was validated when the link was decoded (docs/ui.md, "Analysis screen", decision I185).

import type { CardId } from '../../engine';
import type { AnalysisInput, CardStat } from '../../table';

export interface AnalyzeRequest {
  readonly type: 'analyze';
  readonly id: number; // increases with every request; older answers are dropped
  readonly input: AnalysisInput;
  readonly plays: readonly CardId[]; // the line up to the cursor
  readonly useRealHands: boolean;
  readonly epsilon: number; // share of random moves in the play-outs (ROLLOUT_EPSILONS)
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
