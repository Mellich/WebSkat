// Bidding bubbles: a new bidding event shows a bubble at its player for `durationMs`. Derived from
// the growth of `bidding.history`, so bots that bid in one burst still show one bubble per player.

import { useEffect, useRef, useState } from 'react';
import type { ViewBidEvent } from '../../table';
import { latestPerPlayer, type BidBubble } from './bidBubbles';

type Bubbles = Readonly<Record<string, BidBubble>>;
interface Timer { readonly index: number; readonly handle: ReturnType<typeof setTimeout> }

function without(bubbles: Bubbles, id: string): Bubbles {
  return Object.fromEntries(Object.entries(bubbles).filter(([key]) => key !== id));
}

export function useBidBubbles(history: readonly ViewBidEvent[], durationMs: number): Bubbles {
  // Events present at mount (a reload in the middle of the bidding) show no bubble.
  const [seen, setSeen] = useState(history.length);
  const [bubbles, setBubbles] = useState<Bubbles>({});
  const timers = useRef(new Map<string, Timer>());

  if (history.length !== seen) {
    setSeen(history.length);
    if (history.length > seen && durationMs > 0) {
      const fresh = latestPerPlayer(history, seen);
      setBubbles((cur) => ({ ...cur, ...fresh }));
    }
  }

  // Only a bubble that is new or has a new event gets a timer; the others keep theirs.
  useEffect(() => {
    const map = timers.current;
    for (const [id, bubble] of Object.entries(bubbles)) {
      const running = map.get(id);
      if (running !== undefined && running.index === bubble.index) continue;
      if (running !== undefined) clearTimeout(running.handle);
      const handle = setTimeout(() => {
        map.delete(id);
        setBubbles((cur) => (cur[id]?.index === bubble.index ? without(cur, id) : cur));
      }, durationMs);
      map.set(id, { index: bubble.index, handle });
    }
  }, [bubbles, durationMs]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer.handle);
      map.clear();
    };
  }, []);

  return bubbles;
}
