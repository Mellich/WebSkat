// The game log: what happened at the table, as data (docs/table.md §4a, plan 10).
// Entries hold ids, names and numbers only, never cards; the UI translates them.

import type { Declaration } from '../engine';
import type { GameKindLabel, PlayerId, TableState } from './types';

/** Entries kept in the host's TableState. */
export const LOG_LIMIT = 200;
/** Entries sent with every view (the newest ones). */
export const LOG_VIEW_LIMIT = 100;

export type LogEvent =
  | { readonly kind: 'joined'; readonly playerId: PlayerId; readonly name: string; readonly isBot: boolean; readonly pending: boolean }
  | { readonly kind: 'reconnected' | 'disconnected' | 'left' | 'kicked'; readonly playerId: PlayerId; readonly name: string }
  | { readonly kind: 'replaced'; readonly playerId: PlayerId; readonly name: string; readonly byId: PlayerId; readonly byName: string }
  | { readonly kind: 'dealt'; readonly number: number; readonly dealerId: PlayerId; readonly dealerName: string; readonly bock: boolean }
  | { readonly kind: 'bid'; readonly playerId: PlayerId; readonly name: string; readonly action: 'bid' | 'hold' | 'pass' | 'claim'; readonly value: number | null }
  | { readonly kind: 'skat'; readonly playerId: PlayerId; readonly name: string; readonly pickedUp: boolean }
  | { readonly kind: 'declared'; readonly playerId: PlayerId; readonly name: string; readonly declaration: Declaration }
  | { readonly kind: 'ramsch' | 'aborted'; readonly number: number }
  | { readonly kind: 'bock-started'; readonly games: number }
  | {
      readonly kind: 'result';
      readonly number: number;
      readonly outcome: 'played' | 'passed-in' | 'ramsch';
      readonly declarerId: PlayerId | null;
      readonly declarerName: string | null;
      readonly game: GameKindLabel | null;
      readonly won: boolean | null;
      readonly gameValue: number | null;
      readonly declarerPoints: number | null; // null for Null games and Ramsch
      readonly defenderPoints: number | null;
      readonly loserNames: readonly string[]; // Ramsch only: the players with the most card points
      readonly durchmarschName: string | null; // Ramsch only: the player who took all tricks
    };

/** A logged event with its running number and its time (ctx.now). */
export type LogEntry = LogEvent & { readonly n: number; readonly at: number };

/** Appends events with running numbers and keeps the last LOG_LIMIT entries. No events: same state. */
export function appendLog(s: TableState, events: readonly LogEvent[], at: number): TableState {
  if (events.length === 0) return s;
  const first = (s.log[s.log.length - 1]?.n ?? 0) + 1;
  const added: LogEntry[] = events.map((e, i) => ({ ...e, n: first + i, at }));
  return { ...s, log: [...s.log, ...added].slice(-LOG_LIMIT) };
}
