// Rollout policy and win rule of the game analysis (docs/table.md "Game analysis", decision I183).

import type { Declaration } from '../../engine';
import { heuristicCard } from '../bot/heuristics';
import type { SimOutcome, RolloutPolicy } from '../bot/simulate';
import { ROLLOUT_EPSILON } from './tuning';

/** Normal heuristics, but with probability `epsilon` a random legal card (keeps real-hand play-outs varied). */
export function analysisPolicy(rand: () => number, epsilon = ROLLOUT_EPSILON): RolloutPolicy {
  return (view) => {
    if (rand() < epsilon) {
      const card = view.playable[Math.floor(rand() * view.playable.length)];
      if (card !== undefined) return card;
    }
    return heuristicCard(view);
  };
}

/** Whether the declarer won the play-out (the rule of docs/bots.md and skat-rules; overbidding ignored). */
function declarerWon(declaration: Declaration, outcome: SimOutcome): boolean {
  if (declaration.kind === 'null') return outcome.declarerTricks === 0;
  if (outcome.declarerPoints < 61) return false;
  if (declaration.announce !== 'none' && outcome.declarerPoints < 90) return false;
  if ((declaration.announce === 'schwarz' || declaration.ouvert) && outcome.defenderTricks !== 0) return false;
  return true;
}

/** True when the mover's team (declarer alone, or both defenders) won the play-out. */
export function teamWon(declaration: Declaration, outcome: SimOutcome, moverIsDeclarer: boolean): boolean {
  return declarerWon(declaration, outcome) === moverIsDeclarer;
}

/** Card points of the mover's team at the end (the declarer's includes the Skat). */
export function teamPoints(outcome: SimOutcome, moverIsDeclarer: boolean): number {
  return moverIsDeclarer ? outcome.declarerPoints : 120 - outcome.declarerPoints;
}
