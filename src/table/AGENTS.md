# AGENTS.md — `src/table` (one table, many games, bots; pure)

Read first: `docs/table.md` (state, commands, views), `docs/hidden-information.md` (visibility),
`docs/statistics.md` (records, stats), `docs/bots.md` (bots). Tests: `docs/dev/testing.md`.

## Rules for this folder

- **Pure TypeScript**, same rules as `src/engine` (no DOM, storage, network, `Date`,
  `Math.random`, `console`, timers). Time and randomness arrive as `ctx: { now, seed }` or an
  injected `rand`.
- Imports: `../engine` (its `index.ts`) and files in `src/table`. Never `src/net` or `src/ui`.
- Everything is a **reducer**: `applyCommand(state, actorId, command, ctx)` returns
  `Result<{ state, record }>`. Never throw for invalid commands.
- The engine knows only roles; the table maps player ids ↔ roles per game. The actor of a `game`
  command must be in `game.roles`, otherwise `NOT_ACTIVE_PLAYER`.
- State is JSON-serializable and immutable. Every change goes through `touch()` (`seq + 1`).
- Test helpers (`testing.ts`, `fixtures.ts`, `bot/arena.ts`) are never exported from `index.ts`.

## File map

| File | Contents |
|---|---|
| `types.ts` | `PlayerId`, `BotLevel`, `Player`, `TableStatus`, `ActiveGame`, `TableState`, `TableCommand`, `ReplaceBy`, `Ctx`, `TableErrorCode`, `GameKindLabel`, `ScoreDeltas`, `GameRecord`, `SUIT_LABELS` |
| `table.ts` | `createTable`, `applyCommand` (the reducer), `dealNext`, `tryDeal`, `CommandResult` |
| `rules.ts` | `DEFAULT_RULES`, `setRules` (`set-rules`: host, no game running) |
| `bock.ts` | `BOCK_GAMES`, `BOCK_FACTOR`, `triggersBock` (60 : 60), `nextBockGamesLeft` (Bockrunden, skat-rules §13) |
| `replace.ts` | `replacePlayer` (`replace-player`: a waiting player or a bot takes the seat, role, sitting-out and dealer slot) |
| `seating.ts` | `MIN_SEATS`, `MAX_SEATS`, `MAX_NAME_LENGTH`, `allPlayers`, `touch`, `uniqueName`, `addPlayer`, `removePlayer`, `setConnected`, `markLeaving`, `removeLeavers` |
| `rotation.ts` | `pickFirstDealer`, `sittingOutSeats`, `rolesForDealer`, `roleOf` (Geberskat) |
| `records.ts` | `seegerBonus`, `gameKindOf`, `makeRecord` (played, passed-in and Ramsch records) |
| `stats.ts` | `PlayerStats`, `TableStats`, `computeStats` |
| `viewTypes.ts` | `TableView`, `GameView`, `PlayerPublic`, `ViewTrick`, `ViewLastTrick`, `ViewResult`, `ViewBidEvent`, `DeclarerSpitzen` |
| `view.ts` | `viewFor(state, viewer)` (table part, `you`) |
| `viewGame.ts` | `gameViewFor` (game part; the **allow-list** of visible cards) |
| `bot.ts` | `botStep`, `runBots` (lets the bot on turn act at its own level) |
| `bot/` | bot strategies, see `docs/bots.md` §3 for each file (`index.ts` dispatcher, `knowledge.ts` `BotView`, `easy.ts`, `evaluate.ts`, `auction.ts`, `heuristics.ts`, `ramsch.ts` (Ramsch card play), `cardsLeft.ts`, `sample.ts`, `simulate.ts`, `strong.ts`, `tuning.ts`, `arena.ts`) |
| `index.ts` | public re-exports (also `BotView` type) |
| `testing.ts` | `tableWith`, `ctxFor`, `randomStep`, `playUntilRecords`, `pickRandom` |
| `fixtures.ts` | `finishedGame`, `GRAND_144`, `DIAMONDS_LOST`, `NULL_OUVERT_WON` |
| `*.test.ts` | `table`, `leave`, `replace`, `seating`, `rotation`, `records` (incl. Bock doubling), `stats`, `view` (incl. Bock fields), `view.redaction`, `rules`, `ramsch` (records, stats, views of a Ramsch), `bock` (trigger, counter, table flow), `bot`, `bot/*` (incl. `bot/ramsch`) |

## `view.ts` / `viewGame.ts` are the security boundary

- Build every view from an **allow-list**: set each field explicitly. Never spread `ActiveGame` or
  `GameState` into a view and never "copy then delete".
- Never include `seed`, `initialHands`, other players' `hands`, or the Skat before it is public
  (table in `docs/hidden-information.md` §2).
- `view.redaction.test.ts` must stay green. Extend its oracle when a new field can hold cards.
- `viewFor` for an unknown id must not throw: `you.role = 'lobby'`, public table data only.

## Behavior reminders

- The dealer pointer (`nextDealerIdx`) moves **at deal time**, also for passed-in and aborted
  games. `removePlayer` keeps it on the same upcoming dealer.
- `pending` players are seated only in `dealNext`, before roles are computed.
- Records are created exactly once per finished game (`ActiveGame.recorded`).
- Seeger lost-game bonus goes to **every other seated player** incl. sitting-out ones
  (`seegerBonus`: 40/30/24/20 for 3/4/5/6 seats).
- Bots are always ready; disconnected humans do not block `ready`.
- Bots: strategies take a `BotView`, never `GameState`. `botViewOf` is the only bot function that
  reads the game. Every bot action is checked against `enumerateActions`. Constants live in
  `bot/tuning.ts`.

## Recipes

- **New command:** follow `docs/dev/workflow.md` §4 / skill `change-protocol`. Add a `case` to
  `applyCommand`, return specific `TableErrorCode`s, test success + every error +
  state-unchanged-on-error in `table.test.ts`.
- **New view field:** `viewTypes.ts` → `view.ts`/`viewGame.ts` → `view.test.ts` → zod schema in
  `src/net/schemaView.ts` → `PROTOCOL_VERSION` +1.
- **Changing `TableState`:** host snapshots in `localStorage` hold the old shape; add a migration in
  `src/ui/persist/hosted.ts` with a test.
