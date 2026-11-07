import { enumerateActions, type CardId, type GameAction, type GamePhase, type GameState, type Role } from '../../engine';

export interface BotView {
  readonly role: Role;
  readonly phase: GamePhase;
  readonly hand: readonly CardId[];
  readonly isDeclarer: boolean;
  readonly currentBid: number | null;
  readonly awaiting: 'caller' | 'listener';
  readonly actions: readonly GameAction[];
}

/** The only boundary that projects a full game into what a bot seat may use. */
export function botViewOf(game: GameState, role: Role): BotView {
  return {
    role,
    phase: game.phase,
    hand: [...game.hands[role]],
    isDeclarer: game.declarer === role,
    currentBid: game.bidding.currentBid,
    awaiting: game.bidding.awaiting,
    actions: enumerateActions(game, role),
  };
}
