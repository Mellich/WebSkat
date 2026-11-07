// Locally holds each newly completed trick while bots and opponents continue.

import { useEffect, useState } from 'react';
import type { CardId } from '../../engine';
import type { GameView, ViewLastTrick } from '../../table';


export interface ShownPlay {
  readonly playerId: string;
  readonly card: CardId;
  readonly winner: boolean;
}

export interface ShownTrick {
  readonly plays: readonly ShownPlay[];
  readonly holding: boolean;
  readonly winnerId: string | null;
  readonly dismiss: () => void;
}

export function useShownTrick(game: GameView, displayMs: number): ShownTrick {
  const last = game.lastTrick;
  const lastKey = last === null ? null : JSON.stringify(last);
  const [seenKey, setSeenKey] = useState<string | null>(lastKey);
  const [shownKey, setShownKey] = useState<string | null>(null);

  // A newly completed trick starts its display; adjusting state while rendering avoids a
  // second render pass.
  if (lastKey !== seenKey) {
    setSeenKey(lastKey);
    setShownKey(displayMs > 0 ? lastKey : null);
  }

  useEffect(() => {
    if (shownKey === null || displayMs <= 0) return;
    const timer = setTimeout(() => { setShownKey(null); }, displayMs);
    return () => { clearTimeout(timer); };
  }, [shownKey, displayMs]);

  const dismiss = (): void => { setShownKey(null); };
  const holding = shownKey !== null;
  if (holding) {
    const shown = JSON.parse(shownKey) as ViewLastTrick;
    return {
      plays: shown.plays.map((p) => ({ playerId: p.playerId, card: p.card, winner: p.playerId === shown.winnerId })),
      holding: true,
      winnerId: shown.winnerId,
      dismiss,
    };
  }
  return {
    plays: game.trick.plays.map((p) => ({ playerId: p.playerId, card: p.card, winner: false })),
    holding: false,
    winnerId: null,
    dismiss,
  };
}
