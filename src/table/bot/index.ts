// Bot dispatcher (docs/14-bots.md §3): builds the seat-limited view, asks the level's strategy
// and makes sure the answer is a legal action.

import type { GameAction, GameState, Role } from '../../engine';
import type { BotLevel } from '../types';
import { auctionAction, declareAction, discardAction, skatDecision } from './auction';
import { easyAction, pickOne } from './easy';
import { maxBidOf } from './evaluate';
import { heuristicCard } from './heuristics';
import { botViewOf, type BotView } from './knowledge';
import { strongCard, strongMaxBid } from './strong';

/** The strategy's choice for a view; may in theory be illegal (checked by `botAction`). */
export function chooseBotAction(view: BotView, level: BotLevel, rand: () => number): GameAction {
  if (level === 'easy') return easyAction(view, rand);
  switch (view.phase) {
    case 'bidding':
      return auctionAction(view, level === 'strong' ? strongMaxBid(view) : maxBidOf(view.hand));
    case 'skat-decision':
      return skatDecision(view);
    case 'discarding':
      return discardAction(view);
    case 'declaring':
      return declareAction(view);
    case 'playing':
      return { type: 'play', card: level === 'strong' ? strongCard(view, rand) : heuristicCard(view) };
    case 'finished':
      return easyAction(view, rand);
    default: {
      const unused: never = view.phase;
      return unused;
    }
  }
}

export function isLegalChoice(view: BotView, action: GameAction): boolean {
  const key = JSON.stringify(action);
  return view.actions.some((a) => JSON.stringify(a) === key);
}

/** A legal action for `role` at the given level; falls back to a random legal action. */
export function botAction(game: GameState, role: Role, level: BotLevel, rand: () => number): GameAction {
  const view = botViewOf(game, role);
  const action = chooseBotAction(view, level, rand);
  return isLegalChoice(view, action) ? action : pickOne(view.actions, rand);
}

export { botViewOf, type BotView } from './knowledge';
