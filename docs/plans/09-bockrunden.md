# Plan 09: Bockrunden (table rule)

User request: *"Add Bockrunden to the game: Bockrunden can be enabled in the table settings. If
enabled, if a game ends with 60 points for each team, the next three games are Bockrunden and the
points are doubled."*

Read first: `docs/skat-rules.md` §10 and §12, `docs/table.md`, `docs/statistics.md`,
`src/table/AGENTS.md`, skill `change-protocol`, plan 08 (table rules, `set-rules`,
`hostedMigrate.ts`). Plans 01–08 must be done.

## 1. Current state (after plan 08)

- `TableState.rules: TableRules = { ramsch: boolean }`, changed with `set-rules` while no game
  runs (`src/table/rules.ts`); shown in the lobby (`rule-ramsch`).
- Scores are built per finished game in `src/table/records.ts` (`scoresFor`, Ramsch branch) from
  the engine result; `finishGame` in `src/table/table.ts` creates the record.
- Bock is out of scope today (`decisions.md` D8, `docs/overview.md` §4).
- "60 points for each team" = a suit or Grand game that ends 60 : 60 card points
  (`result.declarerPoints === 60`; the declarer lost). Null has no card points; Ramsch has no
  teams.

## 2. Decisions (log them in `docs/decisions.md`)

1. *Bock rule* (written to `skat-rules.md` §13): when the table rule is on and a suit/Grand game
   ends 60 : 60, the **next 3 games** are Bock games (3 games regardless of the table size, as the
   user asked; a classic "Bockrunde" would be one game per seated player). A 60 : 60 inside a Bock
   game adds 3 more Bock games (they stack). Every recorded game counts as one game of the run
   (also passed-in and Ramsch games); aborted games do not count.
2. *Doubling*: in a Bock game the **game value part** of the score is doubled: standard score
   × 2; Seeger: won `2 × gameValue + 50`, lost `2 × declarerScore − 50` (i.e. `−4 × loseValue − 50`),
   the defenders' bonus (40/30/24/20) is not doubled; Ramsch scores × 2.
3. *Turning the rule off* (with `set-rules`) clears the remaining Bock games.
4. *Records* get `bock` (this game was a Bock game) and `bockTriggered` (this game started new Bock
   games). Protocol version +1. *Supersedes the Bock part of D8.*

## 3. Steps

### Step 1: rules first (`docs/skat-rules.md`)

Add at the end (do not renumber):

```markdown
## 13. Bockrunden (table rule, off by default)

- **Trigger**: a suit or Grand game ends with 60 : 60 card points (§8). Null and Ramsch never
  trigger.
- **Effect**: the next 3 games are Bock games. A trigger inside a Bock game adds 3 more.
  Every finished game (played, passed in, Ramsch) uses up one Bock game; aborted games do not.
- **Scoring in a Bock game**: the game value part counts double.
  - Standard: `2 × declarerScore` (§10.5).
  - Seeger–Fabian: won `2 × gameValue + 50`; lost `2 × declarerScore − 50`; the bonus for the
    other seated players (§10.6) is unchanged.
  - Ramsch: `2 ×` the scores of §12.4.
- The game that triggers is not doubled itself (unless it is a Bock game already).

### 13.1 Worked examples = test vectors

| # | Situation | Standard | Seeger–Fabian |
|---|---|---|---|
| B1 | Bock game, won Grand, value 144 (§10.7 #1) | declarer +288 | declarer +338, others 0 |
| B2 | Bock game, lost Diamonds, value 27 (§10.7 #3), N = 3 | declarer −108 | declarer −158, others +40 |
| B3 | Bock game, Ramsch R1 (§12.5) | F −100 | F −100 |
| B4 | Counter: 0 left, a 60 : 60 game | → 3 left | |
| B5 | Counter: 3 left, a Bock game without trigger | → 2 left | |
| B6 | Counter: 2 left, a Bock game ending 60 : 60 | → 2 − 1 + 3 = 4 left | |
| B7 | Counter: 1 left, a passed-in Bock game | → 0 left | |
```

### Step 2: table (tests first)

- `src/table/types.ts`: `TableRules.bock: boolean`; `TableState.bockGamesLeft: number`;
  `ActiveGame.bock: boolean`; `GameRecord.bock: boolean` and `GameRecord.bockTriggered: boolean`.
- `src/table/rules.ts`: `DEFAULT_RULES` gets `bock: false`; `setRules` sets `bockGamesLeft: 0`
  when the new rules have `bock: false`.
- New `src/table/bock.ts`:
  ```ts
  export const BOCK_GAMES = 3;     // skat-rules §13
  export const BOCK_FACTOR = 2;
  /** True when this finished result starts new Bock games (skat-rules §13). */
  export function triggersBock(result: GameResult): boolean // played, kind suit/grand, declarerPoints === 60
  export function nextBockGamesLeft(left: number, wasBock: boolean, triggered: boolean): number
  ```
- `src/table/table.ts`:
  - `createTable`: `bockGamesLeft: 0`.
  - `dealNext`: `bock: s.rules.bock && s.bockGamesLeft > 0` in the new `ActiveGame`.
  - `finishGame`: `const triggered = s.rules.bock && triggersBock(result)`; build the record with
    `makeRecord(s, game, ctx, triggered)`; set
    `bockGamesLeft: nextBockGamesLeft(s.bockGamesLeft, game.bock, triggered)`.
- `src/table/records.ts`: `makeRecord(table, game, ctx, bockTriggered = false)`;
  `const factor = game.bock ? BOCK_FACTOR : 1;` apply it in `scoresFor` (standard
  `declarerScore × factor`; Seeger won `gameValue × factor + 50`, lost
  `declarerScore × factor − 50`, bonus unchanged) and in the Ramsch branch (`× factor`). Set
  `bock: game.bock`, `bockTriggered`. Passed-in: scores 0 as before.
- `src/table/viewTypes.ts` + `view.ts`/`viewGame.ts`: `table.bockGamesLeft`, `table.rules.bock`
  (already in `rules`), `game.bock`.
- Tests:
  - `src/table/bock.test.ts`: `triggersBock` (suit 60:60 yes, Grand 60:60 yes, 61:59 no, Null no,
    Ramsch no, passed-in no); `nextBockGamesLeft` with B4–B7; table flow: rule on, a finished game
    with `declarerPoints: 60` (use `finishedGame` from `fixtures.ts` with a hand-made result and
    `finishGame` through `applyCommand`, or drive a table with `playUntilRecords` and a
    hand-checked seed) → `bockGamesLeft === 3` and the next dealt game has `bock: true`; an aborted
    Bock game does not change the counter; `set-rules` with `bock: false` clears it.
  - `records.test.ts`: B1, B2 (Seeger and standard, other players), B3; `bock`/`bockTriggered`
    flags.
  - `view.test.ts`: the new fields.
- Run: `npx vitest run src/table`.

### Step 3: wire format and snapshots

- `src/net/schemaGame.ts`: `set-rules` rules object gets `bock: z.boolean()`.
- `src/net/schemaView.ts` (or `schemaRecord.ts`): `table.rules.bock`, `table.bockGamesLeft`
  (`z.number().int().min(0)`), `game.bock`; `GameRecordSchema` `bock: z.boolean().default(false)`,
  `bockTriggered: z.boolean().default(false)`.
- `src/net/constants.ts`: `PROTOCOL_VERSION` + 1 (expected 6).
- `src/ui/persist/hostedMigrate.ts`: `rules.bock` → `false`, `bockGamesLeft` → `0`,
  `game.bock` → `false`, records `bock`/`bockTriggered` → `false`. Test in `hosted.test.ts`.
- `src/net/protocol.test.ts`: old record without the flags parses with `false`.

### Step 4: UI

- `src/ui/screens/TableLobby.tsx` table rules: checkbox `data-testid="rule-bock"`
  (`lobby.ruleBock`: "Bockrunden (60:60 → next 3 games count double)" / "Bockrunden (60:60 → die
  nächsten 3 Spiele zählen doppelt)"); non-hosts see on/off text.
- `src/ui/game/StatusArea.tsx`: when `game.bock`, a line `data-testid="bock-info"`:
  `t('bock.active', { count: view.table.bockGamesLeft })` ("Bock game: points ×2 · {count} Bock
  games left incl. this one" / "Bockspiel: Punkte ×2 · noch {count} Bockspiele inkl. diesem").
  Keep it on one line (ellipsis like `.declared`).
- `src/ui/game/ResultDialog.tsx`: `record?.bock` → line `result.bock` ("Bock game: points
  doubled." / "Bockspiel: Punkte verdoppelt."); `record?.bockTriggered` → line
  `result.bockTriggered` ("60 : 60 — the next 3 games are Bock games." / "60 : 60 — die nächsten
  3 Spiele sind Bockspiele."). Test in `ResultDialog.test.tsx`.
- `src/ui/stats/History.tsx` flags: "Bock" (`game.bock`: "Bock") when `record.bock`.
- Top bar (optional, only if it fits at 360 px): nothing; the status area line is enough.

### Step 5: docs

- `docs/skat-rules.md` (Step 1).
- `docs/table.md`: §1 (`rules.bock`, `bockGamesLeft`, `ActiveGame.bock`), §2 (`bock.ts`
  functions), §4 lifecycle (counter at finish, not at abort), §5 records (factor), §6 views.
- `docs/statistics.md` §1 (`bock`, `bockTriggered`).
- `docs/networking.md` §1 version 6.
- `docs/ui.md` §3 lobby rule; `docs/ui-game-screen.md` §1/§6/§7.
- `docs/overview.md`: §3 feature row; §4 remove Bock from "out of scope".
- `docs/dev/e2e.md` §6: `rule-bock`, `bock-info`. `docs/dev/testing.md` §4.
  `src/table/AGENTS.md` file map (`bock.ts`). `README.md` "How to play".
- `docs/decisions.md`: rows from §2; mark D8 "*Bock part superseded by I…*".

## 4. Validation

- `npm run check` green.
- `npx playwright test e2e/game.spec.ts e2e/layout.spec.ts`.
- Manual: hard to reach 60:60 by chance; rely on the unit tests. Optionally check the Bock line by
  temporarily starting a local table whose snapshot has `bockGamesLeft: 3` (do not commit such
  code).

## 5. Pitfalls

- The counter changes only when a record is created (`finishGame`), never in `dealNext` or
  `abortGame`.
- Doubling happens in the table (`records.ts`); the engine result stays the plain game result, so
  the result dialog's "Value: base × multiplier = value" line still shows the undoubled value.
  The score table (from the record) shows the doubled deltas, and the "Bock game" line explains
  the difference.
- Keep `table.ts` < 300 lines: only calls into `bock.ts` live there.
