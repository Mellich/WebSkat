// The dealt hands and the Skat of a finished game, for the "show all cards" button (pure).

import { ROLES, sortHand, type CardId } from '../../engine';
import type { TableView } from '../../table';
import { namesById } from './seats';

export interface RevealedPlayer {
  readonly name: string;
  readonly cards: readonly CardId[];
}

export interface RevealedHands {
  /** Forehand, middlehand, hindhand: the cards each player was dealt. */
  readonly players: readonly RevealedPlayer[];
  /** The Skat, or null when the game has none (passed-in game). */
  readonly skat: readonly CardId[] | null;
}

/** null while the game is not finished (the view then carries no initial hands). */
export function revealedHands(view: TableView): RevealedHands | null {
  const game = view.game;
  if (game === null || game.initialHands === null) return null;
  const hands = game.initialHands;
  const names = namesById(view);
  return {
    players: ROLES.map((r) => {
      const id = game.roles[r];
      return { name: names.get(id) ?? '?', cards: sortHand(hands[id] ?? [], game.declaration) };
    }),
    skat: game.skat === null ? null : sortHand(game.skat, game.declaration),
  };
}
