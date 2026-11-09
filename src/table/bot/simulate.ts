// Light play-out of a full-information deal with the Normal heuristics for every seat
// (docs/bots.md §6.2). Each simulated player only sees its own PlayView of the sampled world.

import {
  cardPoints,
  effectiveSuit,
  legalCards,
  modeOf,
  nextRole,
  trickWinner,
  type CardId,
  type CompletedTrick,
  type Declaration,
  type Role,
  type Trick,
} from '../../engine';
import { heuristicCard } from './heuristics';
import type { EffectiveSuit, PlayView } from './knowledge';

export interface SimState {
  readonly hands: Readonly<Record<Role, readonly CardId[]>>;
  readonly trick: Trick;
  readonly tricks: readonly CompletedTrick[];
  readonly declarer: Role;
  readonly declaration: Declaration;
  /** Cards in the Skat; they count for the declarer in suit and grand games. */
  readonly skat: readonly CardId[];
  readonly declarerKnowsSkat: boolean;
  readonly voids: Readonly<Record<Role, readonly EffectiveSuit[]>>;
}

export interface SimOutcome {
  readonly declarerPoints: number;
  readonly declarerTricks: number;
  readonly defenderTricks: number;
}

function viewIn(sim: SimState, role: Role): PlayView {
  const mode = modeOf(sim.declaration);
  const hand = sim.hands[role];
  const openHands =
    sim.declaration.ouvert && role !== sim.declarer ? { [sim.declarer]: sim.hands[sim.declarer] } : {};
  return {
    role,
    ramsch: false,
    hand,
    declarer: sim.declarer,
    declaration: sim.declaration,
    trick: sim.trick,
    tricks: sim.tricks,
    openHands,
    ownDiscard: role === sim.declarer && sim.declarerKnowsSkat ? sim.skat : [],
    voids: sim.voids,
    playable: legalCards(hand, sim.trick, mode),
  };
}

/** Applies one card (assumed legal) and returns the new simulated state. */
export function simPlay(sim: SimState, role: Role, card: CardId): SimState {
  const mode = modeOf(sim.declaration);
  const hands = { ...sim.hands, [role]: sim.hands[role].filter((c) => c !== card) };
  const lead = sim.trick.plays[0];
  let voids = sim.voids;
  if (lead !== undefined) {
    const led = effectiveSuit(lead.card, mode);
    if (effectiveSuit(card, mode) !== led && !voids[role].includes(led)) {
      voids = { ...voids, [role]: [...voids[role], led] };
    }
  }
  const plays = [...sim.trick.plays, { role, card }];
  if (plays.length < 3) return { ...sim, hands, voids, trick: { leader: sim.trick.leader, plays } };
  const winner = trickWinner({ leader: sim.trick.leader, plays }, mode);
  return {
    ...sim,
    hands,
    voids,
    tricks: [...sim.tricks, { leader: sim.trick.leader, plays, winner }],
    trick: { leader: winner, plays: [] },
  };
}

function turnOf(sim: SimState): Role {
  const plays = sim.trick.plays;
  const last = plays[plays.length - 1];
  return last === undefined ? sim.trick.leader : nextRole(last.role);
}

/** Plays the deal to the end (Null stops once the declarer has taken a trick). */
export function playOut(start: SimState): SimOutcome {
  let sim = start;
  const isNull = sim.declaration.kind === 'null';
  for (let guard = 0; guard < 40; guard++) {
    const role = turnOf(sim);
    if (sim.hands[role].length === 0) break;
    if (isNull && sim.tricks.some((t) => t.winner === sim.declarer)) break;
    sim = simPlay(sim, role, heuristicCard(viewIn(sim, role)));
  }
  const won = sim.tricks.filter((t) => t.winner === sim.declarer);
  const trickPts = won.reduce((n, t) => n + t.plays.reduce((m, p) => m + cardPoints(p.card), 0), 0);
  const skatPts = sim.skat.reduce((n, c) => n + cardPoints(c), 0);
  return {
    declarerPoints: trickPts + skatPts,
    declarerTricks: won.length,
    defenderTricks: sim.tricks.length - won.length,
  };
}
