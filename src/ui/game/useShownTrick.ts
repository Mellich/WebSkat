// Shows a completed trick for a moment after it is finished (docs/06-ui-ux.md §4). The hand stays
// interactive meanwhile; a new trick that starts replaces the display at once.

import { useEffect, useState } from 'react';
import type { CardId } from '../../engine';
import type { GameView, ViewLastTrick } from '../../table';

export const LAST_TRICK_MS = 1200;

export interface ShownPlay {
  readonly playerId: string;
  readonly card: CardId;
  readonly winner: boolean;
}

export function useShownTrick(game: GameView): readonly ShownPlay[] {
  const last = game.lastTrick;
  const lastKey = last === null ? null : JSON.stringify(last);
  const [seenKey, setSeenKey] = useState<string | null>(lastKey);
  const [shownKey, setShownKey] = useState<string | null>(null);

  // A newly completed trick starts its display; adjusting state while rendering avoids a
  // second render pass.
  if (lastKey !== seenKey) {
    setSeenKey(lastKey);
    setShownKey(lastKey);
  }

  useEffect(() => {
    if (shownKey === null) return;
    const timer = setTimeout(() => {
      setShownKey(null);
    }, LAST_TRICK_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [shownKey]);

  if (game.trick.plays.length > 0) {
    return game.trick.plays.map((p) => ({ playerId: p.playerId, card: p.card, winner: false }));
  }
  if (shownKey === null) return [];
  const shown = JSON.parse(shownKey) as ViewLastTrick;
  return shown.plays.map((p) => ({
    playerId: p.playerId,
    card: p.card,
    winner: p.playerId === shown.winnerId,
  }));
}
