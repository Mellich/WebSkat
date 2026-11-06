// Pure aggregations over the game records of one table (docs/07-statistics.md §2).

import type { GameKindLabel, GameRecord, PlayerId } from './types';

export interface Pair {
  readonly standard: number;
  readonly seeger: number;
}

export interface PlayerStats {
  readonly playerId: PlayerId;
  readonly name: string;
  readonly games: number; // records in which the player was seated (incl. sitting out, passed-in)
  readonly played: number; // games actively played
  readonly satOut: number;
  readonly declared: number;
  readonly won: number;
  readonly lost: number;
  readonly winRate: number | null;
  readonly asDefender: number;
  readonly defenderWins: number;
  readonly total: Pair;
  readonly average: Pair;
  readonly best: Pair;
  readonly worst: Pair;
  readonly byGame: Readonly<Record<GameKindLabel, { declared: number; won: number }>>;
  readonly hands: number;
  readonly ouverts: number;
  readonly schneiderWins: number;
  readonly schwarzWins: number;
  readonly overbids: number;
  readonly highestBid: number | null;
  readonly avgDeclarerCardPoints: number | null;
}

export interface TableStats {
  readonly gamesTotal: number;
  readonly passedIn: number;
  /** Sorted by the standard total, descending; the UI may re-sort by Seeger. */
  readonly players: readonly PlayerStats[];
  readonly byGame: Readonly<Record<GameKindLabel, { played: number; declarerWon: number }>>;
  readonly series: readonly {
    readonly gameNumber: number;
    readonly cumulative: Readonly<Record<PlayerId, Pair>>;
  }[];
}

function perKind<T>(make: () => T): Record<GameKindLabel, T> {
  return { clubs: make(), spades: make(), hearts: make(), diamonds: make(), grand: make(), null: make() };
}

function seatedIn(record: GameRecord, id: PlayerId): boolean {
  return Object.hasOwn(record.scores.standard, id);
}

function playedIn(record: GameRecord, id: PlayerId): boolean {
  return record.outcome === 'played' && Object.values(record.roles).includes(id);
}

function nameOf(id: PlayerId, records: readonly GameRecord[], known: readonly Named[]): string {
  for (let i = records.length - 1; i >= 0; i--) {
    const name = records[i]?.names[id];
    if (name !== undefined) return name;
  }
  return known.find((p) => p.id === id)?.name ?? id;
}

interface Named {
  readonly id: PlayerId;
  readonly name: string;
}

function orderedIds(records: readonly GameRecord[], known: readonly Named[]): PlayerId[] {
  const ids = new Set<PlayerId>(known.map((p) => p.id));
  for (const r of records) {
    for (const id of Object.keys(r.scores.standard)) ids.add(id);
  }
  return [...ids];
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function playerStats(id: PlayerId, records: readonly GameRecord[], name: string): PlayerStats {
  const mine = records.filter((r) => seatedIn(r, id));
  const deltas = mine.map((r) => ({
    standard: r.scores.standard[id] ?? 0,
    seeger: r.scores.seeger[id] ?? 0,
  }));
  const sum = (key: keyof Pair): number => deltas.reduce((acc, d) => acc + d[key], 0);
  const extreme = (key: keyof Pair, pick: (xs: number[]) => number): number =>
    deltas.length === 0 ? 0 : pick(deltas.map((d) => d[key]));
  const pairOf = (pick: (xs: number[]) => number): Pair => ({
    standard: extreme('standard', pick),
    seeger: extreme('seeger', pick),
  });

  const declaredRecords = mine.filter((r) => r.outcome === 'played' && r.declarerId === id);
  const won = declaredRecords.filter((r) => r.won).length;
  const defended = mine.filter((r) => playedIn(r, id) && r.declarerId !== id);
  const games = mine.length;
  const byGame = perKind(() => ({ declared: 0, won: 0 }));
  for (const r of declaredRecords) {
    if (r.game === null) continue;
    byGame[r.game].declared++;
    if (r.won) byGame[r.game].won++;
  }
  const cardPoints = declaredRecords
    .filter((r) => r.game !== 'null' && r.declarerPoints !== null)
    .map((r) => r.declarerPoints ?? 0);
  const bids = declaredRecords.map((r) => r.bid ?? 0);

  return {
    playerId: id,
    name,
    games,
    played: mine.filter((r) => playedIn(r, id)).length,
    satOut: mine.filter((r) => r.sittingOut.includes(id)).length,
    declared: declaredRecords.length,
    won,
    lost: declaredRecords.length - won,
    winRate: declaredRecords.length > 0 ? won / declaredRecords.length : null,
    asDefender: defended.length,
    defenderWins: defended.filter((r) => !r.won).length,
    total: { standard: sum('standard'), seeger: sum('seeger') },
    average: {
      standard: games > 0 ? sum('standard') / games : 0,
      seeger: games > 0 ? sum('seeger') / games : 0,
    },
    best: pairOf((xs) => Math.max(...xs)),
    worst: pairOf((xs) => Math.min(...xs)),
    byGame,
    hands: declaredRecords.filter((r) => r.hand).length,
    ouverts: declaredRecords.filter((r) => r.ouvert).length,
    schneiderWins: declaredRecords.filter((r) => r.won && r.schneider).length,
    schwarzWins: declaredRecords.filter((r) => r.won && r.schwarz).length,
    overbids: declaredRecords.filter((r) => r.overbid).length,
    highestBid: bids.length > 0 ? Math.max(...bids) : null,
    avgDeclarerCardPoints: average(cardPoints),
  };
}

function addScores(
  before: Readonly<Record<PlayerId, Pair>>,
  record: GameRecord,
): Record<PlayerId, Pair> {
  const after: Record<PlayerId, Pair> = { ...before };
  for (const id of Object.keys(record.scores.standard)) {
    const prev = before[id] ?? { standard: 0, seeger: 0 };
    after[id] = {
      standard: prev.standard + (record.scores.standard[id] ?? 0),
      seeger: prev.seeger + (record.scores.seeger[id] ?? 0),
    };
  }
  return after;
}

export function computeStats(
  records: readonly GameRecord[],
  knownPlayers: readonly Named[],
): TableStats {
  const players = orderedIds(records, knownPlayers)
    .map((id) => playerStats(id, records, nameOf(id, records, knownPlayers)))
    .sort((a, b) => b.total.standard - a.total.standard || a.name.localeCompare(b.name));

  const byGame = perKind(() => ({ played: 0, declarerWon: 0 }));
  for (const r of records) {
    if (r.outcome !== 'played' || r.game === null) continue;
    byGame[r.game].played++;
    if (r.won) byGame[r.game].declarerWon++;
  }

  let cumulative: Record<PlayerId, Pair> = {};
  const series = records.map((r) => {
    cumulative = addScores(cumulative, r);
    return { gameNumber: r.number, cumulative };
  });

  return {
    gamesTotal: records.length,
    passedIn: records.filter((r) => r.outcome === 'passed-in').length,
    players,
    byGame,
    series,
  };
}

