# Statistics

All computation is pure (`src/table/records.ts`, `src/table/stats.ts`); rendering is in
`src/ui/stats/`. Statistics are computed from an append-only list of game records.

## 1. GameRecord (`src/table/types.ts`)

One record per **finished** game (played or passed in). Aborted games create none. Built by
`makeRecord` (`table.md` §5).

| Field | Meaning |
|---|---|
| `id` | `<tableKey>-<number>` |
| `number` | game number at the table |
| `timestamp` | `ctx.now` when the game finished |
| `tableSize` | seated players when dealt |
| `dealerId`, `roles`, `sittingOut` | who sat where |
| `names` | player id → name at that time (survives kicks) |
| `outcome` | `'played'` or `'passed-in'` |
| `declarerId`, `bid`, `game` (`clubs`…`null`), `hand`, `ouvert`, `announce` | the declared game (null/false/`none` when passed in) |
| `spitzenWith`, `spitzenCount`, `multiplier`, `gameValue` | value calculation (null for Null where not applicable) |
| `declarerPoints`, `defenderPoints` | card points; **null for Null games** |
| `declarerTricks`, `schneider`, `schwarz`, `overbid`, `won` | result |
| `scores.standard`, `scores.seeger` | delta per **seated** player id (sitting-out players included, 0 when nothing) |

Score rules: `table.md` §5 and `skat-rules.md` §10.5–10.6.

## 2. Aggregation (`computeStats(records, knownPlayers)`)

Returns `TableStats`:
- `gamesTotal`, `passedIn`;
- `players: PlayerStats[]`, sorted by standard total (ties by name); the UI re-sorts by the chosen
  scoring;
- `byGame`: per game kind `{ played, declarerWon }`;
- `series`: after each record, the cumulative `{standard, seeger}` per player (for the chart;
  absent players keep their value).

`PlayerStats`: `games` (records where seated, incl. sitting out and passed-in), `played`,
`satOut`, `declared`, `won`, `lost`, `winRate` (won/declared or null), `asDefender`,
`defenderWins`, `total`, `average` (total / games), `best`, `worst` (each `{standard, seeger}`),
`byGame` (declared/won per kind), `hands`, `ouverts`, `schneiderWins`, `schwarzWins`,
`overbids`, `highestBid`, `avgDeclarerCardPoints`.

Rules: a player was seated in a record iff their id is a key of `record.scores.standard`. Names
come from the latest record containing the id, falling back to `knownPlayers`.

Test vectors (`stats.test.ts`, `records.test.ts`): the three Seeger games of `skat-rules.md`
§10.7 give cumulative A = 90, B = 40, C = 136; a sitting-out player in a 4-player table gets +30
when the declarer loses; passed-in records add 0.

## 3. UI (`src/ui/stats/`)

`StatsPanel` opens from the TopBar (`open-stats`) as a modal (Esc closes) with a Seeger/Standard
toggle (the same `scoring` setting as in Settings) and three tabs (`stats-tab-<id>`):

| Tab | Component | Content |
|---|---|---|
| `standings` | `Standings.tsx` | rank, name, total, games, declared, won %, average, best, worst; viewer's row highlighted |
| `history` | `History.tsx` | one row per game, newest first (`history-row`): number, time, declarer, game label (`gameLabel`), spitzen, bid, card points, flags, result, one delta column per player; passed-in rows greyed; scrolls horizontally on phones |
| `charts` | `ScoreChart.tsx`, `ByType.tsx` | SVG line chart of `series` (geometry in `chartGeometry.ts` `chartPlots`), games by type bars |

Empty state: "No games played yet". The result dialog does **not** use these components
(`ui-game-screen.md` §7); it shows the game's record delta for the selected system.

## 4. Where records live

- Host: in `TableState.records` and therefore in the host snapshot.
- Clients: full list after each welcome (`records`), then one `record` per game; cached in
  `localStorage['webskat.records.<KEY>']` (last 500, zod-validated), loaded when attaching so stats
  show before the host answers.
- Lifetime statistics across tables: not implemented (`decisions.md` I79).
