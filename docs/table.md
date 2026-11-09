# Table layer (`src/table`): a table playing many games

Pure TypeScript, same purity rules as the engine. File map: `src/table/AGENTS.md`. The engine
knows only roles; the table maps **player ids ↔ roles** for each game, owns seats, the dealer
rotation, records and views, and runs bots.

## 1. State (`types.ts`)

```ts
type PlayerId = string;          // host: `h<16 hex>`; remote: 16 hex (host-generated); bots: `bot-<seq>`
type BotLevel = 'easy' | 'normal' | 'strong';
interface Player { id; name /*1..20, unique*/; connected; isBot; botLevel?: BotLevel /*bots only*/; leaving?: boolean /*left during a running game; removed at the next deal*/ }
type TableStatus = 'lobby' | 'in-game';   // 'in-game' while game !== null, incl. a finished game

interface ActiveGame {
  number;                 // 1-based; counts every dealt game (also aborted ones)
  engine: GameState;
  roles: Record<Role, PlayerId>;
  sittingOut: PlayerId[];
  dealerId: PlayerId;
  seed;                   // SECRET, host only
  seatsAtDeal;            // N when dealt (Seeger bonus)
  recorded: boolean;      // record created
  bock: boolean;          // a Bock game (Bockrunden, skat-rules §13): points count double
}

interface TableState {
  key; name; isPublic; hostId;
  maxSeats;               // 6 for tables made in the UI (createTable default); tests may use 3..6
  status;
  players: Player[];      // index = seat, clockwise
  pending: Player[];      // joined while a game was dealt; seated at the next deal
  nextDealerIdx;          // seat of the NEXT dealer
  gameCounter;            // games dealt so far
  game: ActiveGame | null;
  ready: PlayerId[];      // who pressed Continue after the finished game
  rules: TableRules;      // table rules; changed by the host between games (skat-rules §12)
  records: GameRecord[];
  seq;                    // +1 on every change (`touch`)
  log: LogEntry[];        // game log, newest last, at most 200 (§4a)
}

interface TableRules { ramsch: boolean; bock: boolean }    // default off; ramsch is passed as GameOptions.ramschOnPassIn; bock: §13
interface Ctx { now: number; seed: number }   // supplied by the host for every command
```

Constants (`seating.ts`): `MIN_SEATS = 3`, `MAX_SEATS = 6`, `MAX_NAME_LENGTH = 20`.

## 2. Functions

| Function | File | Behavior |
|---|---|---|
| `createTable({key, name, isPublic, hostId, hostName, maxSeats?})` | `table.ts` | Lobby with the host seated; `maxSeats` clamped to 3..6, default 6; `rules = DEFAULT_RULES` |
| `applyCommand(s, actor, command, ctx)` | `table.ts` | The reducer: `Result<{state, record}, TableErrorCode>` (§3). Appends the log events of the command (`commandLog`, §4a); a rejected command changes nothing |
| `appendLog(s, events, at)` | `log.ts` | Numbers the events (`n`, `at`) and keeps the last `LOG_LIMIT` (200). No events: same state |
| `commandLog(before, after, actor, command, record)` | `logEvents.ts` | The log events of one successful command (§4a) |
| `dealNext(s, ctx)` | `table.ts` | Removes leavers first (`removeLeavers`), seats pending players; < 3 seated → back to lobby. Dealer = `nextDealerIdx % N`, pointer moves one seat on, `newGame(ctx.seed, { ramschOnPassIn: rules.ramsch })`, roles from the rotation, `ready` = bots |
| `setRules(s, actor, rules)` | `rules.ts` | Host only, not while a game runs (lobby or finished game); sets `rules`. Turning `bock` off sets `bockGamesLeft = 0`. `DEFAULT_RULES = { ramsch: false, bock: false }` |
| `triggersBock(result)` | `bock.ts` | True for a played suit or Grand game with `declarerPoints === 60` (60 : 60; Null and Ramsch never) |
| `nextBockGamesLeft(left, wasBock, triggered)` | `bock.ts` | `max(0, left − (wasBock ? 1 : 0)) + (triggered ? 3 : 0)`; `BOCK_GAMES = 3`, `BOCK_FACTOR = 2` |
| `tryDeal(s, ctx)` | `table.ts` | Deals the next game when the game is finished and every **connected human** is in `ready` |
| `addPlayer(s, {id, name, isBot?, botLevel?})` | `seating.ts` | Known id → reconnect (`connected = true`). Else validates the name (`INVALID_NAME`), checks `players + pending < maxSeats` (`TABLE_FULL`), makes the name unique, seats the player if `game === null`, otherwise adds to `pending` |
| `removePlayer(s, id)` | `seating.ts` | Removes from seats or pending; keeps the pointer on the same upcoming dealer (a removed seat before the pointer shifts it down); drops the id from `ready` |
| `setConnected(s, id, connected)` | `seating.ts` | Sets the `connected` flag; `connected = true` also clears `leaving` |
| `markLeaving(s, id)` | `seating.ts` | Seated player leaves during a running game: `connected = false`, `leaving = true` (keeps the seat) |
| `removeLeavers(s)` | `seating.ts` | `removePlayer` for every seated player with `leaving` (keeps the dealer pointer right) |
| `replacePlayer(s, actor, target, by)` | `replace.ts` | Gives the seat of `target` to a pending player or a new bot (`ReplaceBy`). Same index in `players`; `roles`, `sittingOut` and `dealerId` of a dealt game map to the newcomer; `engine`, `number`, `seed`, `recorded` unchanged. Only the errors of §3 |
| `uniqueName(existing, wanted)` | `seating.ts` | `Anna`, `Anna (2)`, … (cut to 20 chars) |
| `rolesForDealer(players, dealerIdx)` | `rotation.ts` | forehand = d+1, middlehand = d+2, hindhand = d+3 (mod N); sitting out = dealer and d+4, d+5 (N ≥ 4) |
| `pickFirstDealer(seed, n)` | `rotation.ts` | `seed % n` |
| `roleOf(game, playerId)` | `rotation.ts` | role or `null` |
| `makeRecord(table, game, ctx)` | `records.ts` | §5 |
| `computeStats(records, knownPlayers)` | `stats.ts` | `statistics.md` §2 |
| `viewFor(s, viewer)` | `view.ts` | §6 |
| `botStep(s, ctx, rand)`, `runBots(s, ctx, rand, maxSteps?)` | `bot.ts` | §7 |

## 3. Commands (`applyCommand`)

| Command | Who | Allowed when | Effect | Errors |
|---|---|---|---|---|
| `start` | host | `status === 'lobby'`, ≥ 3 seated | `nextDealerIdx = pickFirstDealer(seed, N)`, then `dealNext` | `NOT_HOST`, `WRONG_STATUS`, `TOO_FEW_PLAYERS` |
| `game {action}` | an active player of the running game | game dealt and not finished | `engine.applyAction(role, action)`. If the game finishes: record created once, `recorded = true`, `ready` = bots, then `tryDeal` | `WRONG_STATUS`, `NOT_ACTIVE_PLAYER`, any `GameErrorCode` |
| `ready` | a seated player | game finished | adds to `ready`, then `tryDeal` | `WRONG_STATUS`, `NOT_SEATED` |
| `abort-game` | host | game running | drops the game (no record) and deals the next one (pointer already moved) | `NOT_HOST`, `WRONG_STATUS` |
| `kick {playerId}` | host | no game or finished | `removePlayer`; < 3 seated → lobby; then `tryDeal`. During a running game use `replace-player` | `NOT_HOST`, `GAME_RUNNING`, `CANNOT_KICK_HOST`, `UNKNOWN_PLAYER` |
| `replace-player {playerId, by}` | host | any time | `by = {kind:'pending', playerId}` (a waiting player) or `{kind:'bot', level}` (new bot `bot-<seq>`, named by `botName`, always ready). The target leaves the table; its seat, role and dealer slot go to the newcomer (`replacePlayer`). A finished game may now be fully ready → `tryDeal` | `NOT_HOST`, `CANNOT_KICK_HOST` (target is the host), `UNKNOWN_PLAYER` (no such seated target, or no such waiting player) |
| `add-bot` | host | no game or finished | adds `bot-<seq>` named by `botName` (first unused of the pool, `Guguurz` first) at level `normal` | `NOT_HOST`, `GAME_RUNNING`, `TABLE_FULL` |
| `set-bot-level {playerId, level}` | host | any time | sets that bot's level; used from its next action | `NOT_HOST`, `UNKNOWN_PLAYER`, `NOT_A_BOT` |
| `set-rules {rules}` | host | no game or finished | `setRules`: replaces `rules` (`{ ramsch }`); applies from the next deal | `NOT_HOST`, `GAME_RUNNING` |
| `leave` | anyone | — | pending → removed. Seated + game running → `markLeaving` (seat kept, removed at the next deal). Seated otherwise → removed (< 3 → lobby) | `HOST_CANNOT_LEAVE`, `UNKNOWN_PLAYER` |

`TableErrorCode` = `GameErrorCode` + `NOT_HOST`, `NOT_SEATED`, `NOT_ACTIVE_PLAYER`,
`WRONG_STATUS`, `TOO_FEW_PLAYERS`, `TABLE_FULL`, `UNKNOWN_PLAYER`, `GAME_RUNNING`,
`INVALID_NAME`, `CANNOT_KICK_HOST`, `NOT_A_BOT`, `HOST_CANNOT_LEAVE`. Every code needs an
`error.<CODE>` text in both i18n files.

Joining is not a command: the host calls `addPlayer` when a `join` message arrives
(`networking.md` §4).

## 4. Lifecycle rules (do not break)

- The dealer pointer moves **when a game is dealt**, so it also moves for passed-in and aborted
  games.
- Table rules change only when no game runs, so every game is dealt under the rules it was
  dealt with.
- The Bock counter (`bockGamesLeft`) changes only when a record is created (`finishGame`), never
  at deal or abort. A game is a Bock game when the rule is on and the counter is above 0 at deal
  time (`ActiveGame.bock`). Passed-in and Ramsch games use up one Bock game too.
- A player who leaves during a running game keeps the seat (`leaving`, disconnected) until the next
  deal; `dealNext` removes leavers first. Rejoining with the same id before that cancels the leave.
- Pending players are seated only in `dealNext` (before roles are computed). New players are
  appended as the last seat. A dealt game never changes its roles; the host can change who holds a
  role with `replace-player` (decision I125). Records keep the names of the time they were made.
- Bots are always ready. Disconnected humans do not block the next deal; the game then waits on
  their turn (`view.game.waitingFor`).
- A bot-only table (or one whose humans are all disconnected) keeps dealing by itself because
  `tryDeal` also runs right after a game finishes.
- Each finished game creates exactly one record (`ActiveGame.recorded`). Aborted games create none.

## 4a. Game log (`log.ts`, `logEvents.ts`, plan 10)

- The host keeps the log in `TableState.log` (part of the host snapshot). `LOG_LIMIT = 200`
  entries are kept, `LOG_VIEW_LIMIT = 100` travel with each view (`TableView.log`, the newest).
- An entry is `LogEvent & { n, at }`: `n` is a running number, `at` is `ctx.now`. Entries hold
  ids, names and numbers, never cards; the UI translates them (`src/ui/log/logText.ts`).
- Event kinds: `joined` (with `isBot`, `pending`), `reconnected`, `disconnected`, `left`,
  `kicked`, `replaced` (`byId`/`byName`), `dealt` (game number, dealer, `bock`), `bid` (`bid` with
  value, `hold`, `pass`, `claim` = 18), `skat` (`pickedUp`: Skat or Hand), `declared` (the
  `Declaration`), `aborted`, `ramsch` (everybody passed, the game is a Ramsch), `bock-started`
  (`games`: the 60 : 60 game starts the next `BOCK_GAMES` = 3 Bock games), `result` (`played`,
  `passed-in` or `ramsch`; for a played game declarer, game kind, won, game value, card points,
  none for Null; for a Ramsch `loserNames` and `durchmarschName`).
- Not logged: card plays and discards (too noisy; views hold only the current and last trick).
- Who writes: `applyCommand` derives the events of every successful command (`commandLog`), so bot
  actions are logged too, in this order: the command's own events, `ramsch` if the command moved
  the game into Ramsch, the `result` of a game it finished, `bock-started` if that game was a 60 : 60
  trigger, the `dealt` of a game it started. The host controller logs `joined` (new peer),
  `reconnected`/`disconnected` (a real change of the connection flag only, `net/hostLog.ts`).

## 5. Records (`records.ts`)

`makeRecord` builds a `GameRecord` (fields: `statistics.md` §1). `scores` has an entry for every
**seated** player (sitting-out players included):

```
standard: declarer = result.declarerScore; everyone else 0
seeger:   won  → declarer = gameValue + 50; others 0
          lost → declarer = declarerScore − 50; every other seated player = seegerBonus(seatsAtDeal)
          passed-in → all 0
seegerBonus(N): 3 → 40, 4 → 30, 5 → 24, 6 → 20
Ramsch (outcome 'ramsch'): standard = seeger = the engine's Ramsch scores (skat-rules §12.4), mapped to ids

Bock (skat-rules §13): in a Bock game (`game.bock`) every game-value part is multiplied by 2:
`declarerScore × 2` (standard), won `gameValue × 2 + 50` and lost `declarerScore × 2 − 50`
(Seeger; the defenders' bonus is not doubled), Ramsch scores × 2. `makeRecord(table, game, ctx,
bockTriggered)` sets `bock` and `bockTriggered` (`finishGame` passes `triggersBock(result)`).
```

`names` holds the names at that time, so history stays readable after a kick. `id` is
`<tableKey>-<number>`. A Ramsch record has `declarerId`, `bid` and the declared-game fields `null`
and the `ramsch` block: `points`, `tricks`, `loserIds`, `jungfrau`, `durchmarschId` (all by id).

## 6. Views (`view.ts`, `viewGame.ts`, `viewTypes.ts`)

`viewFor(state, viewer)` → `TableView`:

- `seq`
- `log`: the newest `LOG_VIEW_LIMIT` (100) entries of `TableState.log` (§4a); public, no cards.
- `table`: `key`, `name`, `hostId`, `maxSeats`, `status`, `players` / `pending` as `PlayerPublic`
  (`id`, `name`, `connected`, `isBot`, `botLevel` (null for humans), `seat` (null while pending)),
  `nextDealerId`, `readyIds`, `rules` (`TableRules`, shown in the lobby), `bockGamesLeft`.
- `you`: `id`, `seat`, `role`: a `Role`, `'sitting-out'`, `'pending'` or `'lobby'` (also for
  unknown ids; never throws).
- `game`: `GameView` or `null`.

`GameView` fields: `number`, `phase`, `ramsch` (a Ramsch is played or was played: no declarer),
`bock` (a Bock game: points count double),
`dealerId`, `roles` (Role → id), `sittingOut`, `turnId`,
`waitingFor` (= `turnId` if that player is disconnected), `bidding` (`stage`, `callerId`,
`listenerId`, `currentBid`, `history` with player ids), `declarerId`, `bid`, `pickedUpSkat`,
`declaration`, `myHand`, `openHands`, `handCounts`, `skat`, `discarded`, `trick`
(`leaderId`, `plays[{playerId, card}]`), `lastTrick` (+ `winnerId`), `tricksWon`, `legal` (the
engine's `Legal` for the viewer, `{}` if not their turn), `result` (`ViewResult`: the
`GameResult` with `declarerId` instead of the role; a Ramsch result maps its per-role fields to ids: `points`, `tricks`, `skatToId`, `loserIds`, `jungfrau`, `durchmarschId`, `scores`), `declarerSpitzen` (declarer only, while
declaring: spitzen for Grand and each suit, for the floor-value hint).

Which card fields each viewer gets: `hidden-information.md` §2. After a finished Ramsch the Skat is
visible to everybody (`skat` and `discarded` as after a played game).

## 7. Bots on the table (`bot.ts`)

- `botStep(s, ctx, rand)`: if the player on turn is a bot, ask
  `botAction(game.engine, role, bot.botLevel ?? 'normal', rand)` and apply it with
  `applyCommand`. Returns `null` when a human must act or no game is running. Throws if the table
  rejects a bot action (a bug).
- `runBots` loops `botStep` up to `maxSteps` (default 100 000).
- The host calls `botStep` itself after each command (`networking.md` §5). Strategies: `bots.md`.

## 8. Test helpers (test-only, not exported from `index.ts`)

- `src/table/testing.ts`: `tableWith(count, {bots?, maxSeats?})`, `ctxFor(seed, now?)`,
  `randomStep(s, ctx, rand)`, `playUntilRecords(...)`, `pickRandom`.
- `src/table/fixtures.ts`: `finishedGame(...)` and results `GRAND_144`, `DIAMONDS_LOST`,
  `NULL_OUVERT_WON` (the Seeger vectors of `skat-rules.md` §10.7).
