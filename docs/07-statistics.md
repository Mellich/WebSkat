# 07 — Statistics

Goal: "points per player, points and game type per game, etc." for the table, computed from an
append-only list of **game records**. All computation is pure (`src/table/records.ts`,
`src/table/stats.ts`); rendering is in `src/ui/stats/`.

## 1. GameRecord (`src/table/types.ts`)

One record per **finished** game (played or passed in). Aborted games create no record.

```ts
export type GameKindLabel = 'clubs' | 'spades' | 'hearts' | 'diamonds' | 'grand' | 'null';

export interface GameRecord {
  readonly id: string;                       // `${tableKey}-${number}`
  readonly number: number;                   // game number at the table (ActiveGame.number)
  readonly timestamp: number;                // ctx.now at finish (ms since epoch)
  readonly tableSize: number;                // N seated players when dealt
  readonly dealerId: string;
  readonly roles: { forehand: string; middlehand: string; hindhand: string };
  readonly sittingOut: readonly string[];
  readonly names: Readonly<Record<string, string>>;   // playerId → name at that time (history stays readable after kicks)
  readonly outcome: 'passed-in' | 'played';
  // below only when outcome === 'played'
  readonly declarerId: string | null;
  readonly bid: number | null;
  readonly game: GameKindLabel | null;
  readonly hand: boolean;
  readonly ouvert: boolean;
  readonly announce: 'none' | 'schneider' | 'schwarz';
  readonly spitzenWith: boolean | null;      // "mit" / "ohne"
  readonly spitzenCount: number | null;
  readonly multiplier: number | null;
  readonly gameValue: number | null;
  readonly declarerPoints: number | null;    // card points (null for Null games)
  readonly defenderPoints: number | null;
  readonly declarerTricks: number | null;
  readonly schneider: boolean;
  readonly schwarz: boolean;
  readonly overbid: boolean;
  readonly won: boolean;                     // declarer won
  readonly scores: {
    readonly standard: Readonly<Record<string, number>>;   // delta per seated player id
    readonly seeger: Readonly<Record<string, number>>;
  };
}
```

`makeRecord(table, game, ctx)` builds it from the finished `ActiveGame` (`game.engine.result`,
`roles`, `sittingOut`, `seatsAtDeal`). Players present in `table.players` at that time are the keys
of `scores` (every seated player, including sitting-out ones, gets an entry — 0 when nothing).

Score deltas (03 §10.5/10.6):
```
standard: declarer = result.declarerScore; all others 0.
seeger:   won  → declarer = gameValue + 50
          lost → declarer = result.declarerScore - 50 ; each other seated player = bonus(seatsAtDeal)
          passed-in → all 0
```
Because `declarerScore` is already `+value` or `-2×loseValue`, Seeger = `declarerScore ± 50`.

## 2. Aggregations (`stats.ts`)

```ts
export interface PlayerStats {
  playerId: string; name: string;
  games: number;                 // records in which the player was seated (incl. sitting out and passed-in)
  played: number;                // games actively played (any role)
  satOut: number;
  declared: number;              // times declarer
  won: number;                   // declared & won
  lost: number;                  // declared & lost
  winRate: number | null;        // won / declared
  asDefender: number;
  defenderWins: number;          // declarer lost while I defended
  total: { standard: number; seeger: number };
  average: { standard: number; seeger: number };       // total / games (seated) — 0 if no games
  best: { standard: number; seeger: number };          // max single delta
  worst: { standard: number; seeger: number };
  byGame: Record<GameKindLabel, { declared: number; won: number }>;
  hands: number; ouverts: number;                      // declared as Hand / Ouvert
  schneiderWins: number; schwarzWins: number;          // declarer won with schneider/schwarz achieved
  overbids: number;
  highestBid: number | null;
  avgDeclarerCardPoints: number | null;                // over declared suit/grand games
}

export interface TableStats {
  gamesTotal: number; passedIn: number;
  players: PlayerStats[];                               // sorted by total.<scoring> desc (UI sorts)
  byGame: Record<GameKindLabel, { played: number; declarerWon: number }>;
  series: { gameNumber: number; cumulative: Record<string, { standard: number; seeger: number }> }[];
}

export function computeStats(records: readonly GameRecord[], knownPlayers: readonly { id: string; name: string }[]): TableStats;
```
Rules: a player "was seated" for a record iff their id is a key of `record.scores`. `played` =
seated and in `roles` values; `satOut` = in `sittingOut`. Passed-in records count toward
`passedIn`/`gamesTotal` and toward `games` of seated players, but not toward `played`.
Names come from the **latest** record that contains the id (`record.names`), falling back to
`knownPlayers`.

`series` is the running sum after each game (for the chart); players absent from a game keep their
cumulative value.

## 3. UI (`src/ui/stats/`)

Opened from the top bar as a drawer/modal with three tabs (and a toggle **Seeger | Standard**,
default from settings, persisted):

1. **Standings** — table sorted by total: rank, name, total, games, declared, won %, avg, best,
   worst. Highlight the viewer's row.
2. **History** — one row per game, newest first:
   `# · time · Declarer · Game ("Grand Hand", "Hearts Ouvert", "Null") · mit/ohne N · bid · card points
   (83–37) · flags (Schneider, Schwarz, Overbid) · result (+96 / −54) ·` and a compact per-player
   delta column set (one column per player; Seeger/Standard per toggle). Passed-in rows greyed
   "Passed in". Game label helper `gameLabel(record, t)` shared with `ResultDialog`.
3. **Charts** — `ScoreChart`: a plain `<svg>` line chart of `series` (one polyline per player, legend
   with names, axis labels = game numbers, responsive `viewBox`). No chart library. Plus a small
   bar list "Games by type" from `byGame`.

Empty state: "No games played yet".

## 4. Persistence

- **Host**: `records` live inside `TableState` and in the host snapshot (`05` §9).
- **Clients**: receive `records` after joining and `record` after each game; they also store the
  list in `localStorage['webskat.records.<key>']` (zod-validated on load, capped to 500 records)
  so that a page reload shows stats immediately even before the host answers.
- **Lifetime personal stats** (optional, Phase 9): `localStorage['webskat.lifetime']` keeps per
  player-name aggregates over all tables: games, declared, won, total scores. Display on Home under
  "Your stats". Skip if time is short.

## 5. Tests (`stats.test.ts`, `records.test.ts`)

- The Seeger vectors from 03 §10.7 → records for games 1–3 → `series` ends at A=90, B=40, C=136.
- Passed-in record contributes 0 and increments `passedIn`.
- Sitting-out player in a 4-player table receives the Seeger bonus when the declarer loses (+30).
- Names survive a kick (record names used).
- Cumulative series is monotone in length = number of records.
