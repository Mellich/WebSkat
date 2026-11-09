// Property test (docs/dev/testing.md §4): views never reveal a card the viewer may not see.

import { describe, expect, it } from 'vitest';
import { ROLES, mulberry32, type CardId } from '../engine';
import { addPlayer } from './seating';
import { ctxFor, randomStep, tableWith } from './testing';
import { applyCommand } from './table';
import type { PlayerId, TableState } from './types';
import { viewFor } from './view';

const CARD_PATTERN = /\b[CSHD](?:7|8|9|10|J|Q|K|A)\b/g;
const STRANGER = 'stranger';

/** Cards a viewer may see, derived from the engine state (not from the view code). */
function allowedCards(s: TableState, viewer: PlayerId): Set<CardId> {
  const allowed = new Set<CardId>();
  const g = s.game;
  if (g === null) return allowed;
  const e = g.engine;
  const add = (cards: readonly CardId[]): void => {
    for (const c of cards) allowed.add(c);
  };
  const role = ROLES.find((r) => g.roles[r] === viewer);
  if (role !== undefined) add(e.hands[role]);
  add(e.trick.plays.map((p) => p.card));
  const last = e.tricks.at(-1);
  if (last !== undefined) add(last.plays.map((p) => p.card));

  const declarer = e.declarer;
  // An ouvert declarer's remaining cards stay face-up, also when a Null ends early.
  if (declarer !== null && e.declaration?.ouvert === true) {
    add(e.hands[declarer]);
  }
  const declarerViewer = declarer !== null && g.roles[declarer] === viewer;
  if (declarerViewer && e.pickedUpSkat && (e.phase === 'discarding' || e.phase === 'declaring')) {
    add(e.skat);
  }
  if (e.phase === 'finished' && (declarer !== null || e.ramsch)) {
    add(e.skat);
    add(e.discarded);
    for (const t of e.tricks) add(t.plays.map((p) => p.card));
  }
  return allowed;
}

/** Asserts the redaction for every viewer; returns how many card ids were shown in total. */
function assertRedacted(s: TableState, viewers: readonly PlayerId[]): number {
  const leaks: string[] = [];
  let shown = 0;
  for (const viewer of viewers) {
    const json = JSON.stringify(viewFor(s, viewer));
    if (json.includes('"seed"') || json.includes('initialHands')) leaks.push(`${viewer}: secret key`);
    const allowed = allowedCards(s, viewer);
    for (const card of json.match(CARD_PATTERN) ?? []) {
      shown++;
      if (!allowed.has(card as CardId)) leaks.push(`${viewer} sees ${card}`);
    }
  }
  expect(leaks).toEqual([]);
  return shown;
}

describe('view redaction', () => {
  it('reveals only allowed cards to every viewer after every action of 300 random games', () => {
    const rand = mulberry32(2024);
    let shownCards = 0;
    let finishedGames = 0;
    for (let g = 0; g < 300; g++) {
      const seats = 3 + (g % 4);
      const ctx = ctxFor(Math.floor(rand() * 4294967296), 0);
      // Every second game is played with the Ramsch rule (the Skat is public after a Ramsch).
      const rules = { ramsch: g % 2 === 0, bock: false };
      const lobby = applyCommand(tableWith(seats), 'p0', { type: 'set-rules', rules }, ctx);
      if (!lobby.ok) throw new Error(lobby.error.code);
      const started = applyCommand(lobby.value.state, 'p0', { type: 'start' }, ctx);
      if (!started.ok) throw new Error(started.error.code);
      let s = started.value.state;
      const joiner = addPlayer(s, { id: `late${String(g)}`, name: 'Late' });
      if (joiner.ok) s = joiner.value;

      for (let step = 0; step < 500; step++) {
        const viewers = [...s.players, ...s.pending].map((p) => p.id).concat(STRANGER);
        shownCards += assertRedacted(s, viewers);
        if (s.game?.engine.phase === 'finished') {
          finishedGames++;
          break;
        }
        const next = randomStep(s, ctx, rand);
        if (next === null) break;
        s = next;
      }
    }
    expect(finishedGames).toBe(300);
    expect(shownCards).toBeGreaterThan(0);
  }, 120_000);
});
