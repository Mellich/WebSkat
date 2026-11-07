// Easy level: the original random bot (docs/14-bots.md §1).

import type { GameAction } from '../../engine';
import type { BotView } from './knowledge';
import { EASY_PASS_PROBABILITY } from './tuning';

export function pickOne<T>(items: readonly T[], rand: () => number): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error('bot has no legal action to choose from');
  return item;
}

/** Uniform among legal actions; in the auction it usually passes, otherwise bids/holds/claims. */
export function easyAction(view: BotView, rand: () => number): GameAction {
  const actions = view.actions;
  if (view.phase !== 'bidding') return pickOne(actions, rand);
  const pass = actions.find((a) => a.type === 'pass');
  if (pass !== undefined && rand() < EASY_PASS_PROBABILITY) return pass;
  const pool = actions.filter((a) => a.type === 'bid' || a.type === 'hold' || a.type === 'claim');
  return pickOne(pool.length > 0 ? pool : actions, rand);
}
