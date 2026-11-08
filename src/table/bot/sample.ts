// Random hidden-card deals consistent with what a bot knows (docs/bots.md §6.1).

import { effectiveSuit, modeOf, type CardId, type Role } from '../../engine';
import { outstanding } from './cardsLeft';
import { otherRoles, type BotView } from './knowledge';
import { SAMPLE_TRIES } from './tuning';

export interface SampledDeal {
  readonly hands: Readonly<Record<Role, readonly CardId[]>>;
  /** The two Skat cards in this world (known ones for a declarer who picked up). */
  readonly skat: readonly CardId[];
}

export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

interface Holder {
  readonly id: Role | 'skat';
  readonly need: number;
  readonly cards: CardId[];
}

function tryDeal(pool: readonly CardId[], holders: readonly Holder[], view: BotView, rand: () => number, useVoids: boolean): boolean {
  const mode = view.declaration === null ? null : modeOf(view.declaration);
  for (const card of shuffle(pool, rand)) {
    const eligible = holders.filter((h) => {
      if (h.cards.length >= h.need) return false;
      if (!useVoids || h.id === 'skat' || mode === null) return true;
      return !view.voids[h.id].includes(effectiveSuit(card, mode));
    });
    const room = eligible.reduce((n, h) => n + h.need - h.cards.length, 0);
    if (room === 0) return false;
    let pick = rand() * room;
    const chosen = eligible.find((h) => {
      pick -= h.need - h.cards.length;
      return pick < 0;
    }) ?? eligible[eligible.length - 1];
    chosen?.cards.push(card);
  }
  return true;
}

/** One deal of the cards the bot cannot see. Never throws; ignores voids if they cannot be met. */
export function sampleDeal(view: BotView, rand: () => number): SampledDeal {
  const skatKnown = view.ownDiscard.length === 2;
  const open = view.openHands;
  const pool = outstanding(view).filter((c) => !Object.values(open).some((cards) => cards.includes(c)));
  const others = otherRoles(view.role);
  for (let attempt = 0; attempt <= SAMPLE_TRIES; attempt++) {
    const holders: Holder[] = others
      .filter((r) => open[r] === undefined)
      .map((r) => ({ id: r, need: view.handCounts[r], cards: [] }));
    if (!skatKnown) holders.push({ id: 'skat', need: 2, cards: [] });
    if (tryDeal(pool, holders, view, rand, attempt < SAMPLE_TRIES)) {
      const hands: Record<Role, readonly CardId[]> = { forehand: [], middlehand: [], hindhand: [] };
      hands[view.role] = view.hand;
      for (const r of others) hands[r] = open[r] ?? holders.find((h) => h.id === r)?.cards ?? [];
      const skat = skatKnown ? view.ownDiscard : (holders.find((h) => h.id === 'skat')?.cards ?? []);
      return { hands, skat };
    }
  }
  throw new Error('sampling failed even without void constraints');
}
