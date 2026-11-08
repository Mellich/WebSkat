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
  records: GameRecord[];
  seq;                    // +1 on every change (`touch`)
}

interface Ctx { now: number; seed: number }   // supplied by the host for every command
```

Constants (`seating.ts`): `MIN_SEATS = 3`, `MAX_SEATS = 6`, `MAX_NAME_LENGTH = 20`.

## 2. Functions

| Function | File | Behavior |
|---|---|---|
| `createTable({key, name, isPublic, hostId, hostName, maxSeats?})` | `table.ts` | Lobby with the host seated; `maxSeats` clamped to 3..6, default 6 |
| `applyCommand(s, actor, command, ctx)` | `table.ts` | The reducer: `Result<{state, record}, TableErrorCode>` (§3) |
| `dealNext(s, ctx)` | `table.ts` | Removes leavers first (`removeLeavers`), seats pending players; < 3 seated → back to lobby. Dealer = `nextDealerIdx % N`, pointer moves one seat on, `newGame(ctx.seed)`, roles from the rotation, `ready` = bots |
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
| `replace-player {playerId, by}` | host | any time | `by = {kind:'pending', playerId}` (a waiting player) or `{kind:'bot', level}` (new bot `bot-<seq>`, always ready). The target leaves the table; its seat, role and dealer slot go to the newcomer (`replacePlayer`). A finished game may now be fully ready → `tryDeal` | `NOT_HOST`, `CANNOT_KICK_HOST` (target is the host), `UNKNOWN_PLAYER` (no such seated target, or no such waiting player) |
| `add-bot` | host | no game or finished | adds `bot-<seq>` named `Bot`, `Bot (2)`, … at level `normal` | `NOT_HOST`, `GAME_RUNNING`, `TABLE_FULL` |
| `set-bot-level {playerId, level}` | host | any time | sets that bot's level; used from its next action | `NOT_HOST`, `UNKNOWN_PLAYER`, `NOT_A_BOT` |
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

## 5. Records (`records.ts`)

`makeRecord` builds a `GameRecord` (fields: `statistics.md` §1). `scores` has an entry for every
**seated** player (sitting-out players included):

```
standard: declarer = result.declarerScore; everyone else 0
seeger:   won  → declarer = gameValue + 50; others 0
          lost → declarer = declarerScore − 50; every other seated player = seegerBonus(seatsAtDeal)
          passed-in → all 0
seegerBonus(N): 3 → 40, 4 → 30, 5 → 24, 6 → 20
```

`names` holds the names at that time, so history stays readable after a kick. `id` is
`<tableKey>-<number>`.

## 6. Views (`view.ts`, `viewGame.ts`, `viewTypes.ts`)

`viewFor(state, viewer)` → `TableView`:

- `seq`
- `table`: `key`, `name`, `hostId`, `maxSeats`, `status`, `players` / `pending` as `PlayerPublic`
  (`id`, `name`, `connected`, `isBot`, `botLevel` (null for humans), `seat` (null while pending)),
  `nextDealerId`, `readyIds`.
- `you`: `id`, `seat`, `role`: a `Role`, `'sitting-out'`, `'pending'` or `'lobby'` (also for
  unknown ids; never throws).
- `game`: `GameView` or `null`.

`GameView` fields: `number`, `phase`, `dealerId`, `roles` (Role → id), `sittingOut`, `turnId`,
`waitingFor` (= `turnId` if that player is disconnected), `bidding` (`stage`, `callerId`,
`listenerId`, `currentBid`, `history` with player ids), `declarerId`, `bid`, `pickedUpSkat`,
`declaration`, `myHand`, `openHands`, `handCounts`, `skat`, `discarded`, `trick`
(`leaderId`, `plays[{playerId, card}]`), `lastTrick` (+ `winnerId`), `tricksWon`, `legal` (the
engine's `Legal` for the viewer, `{}` if not their turn), `result` (`ViewResult`: the
`GameResult` with `declarerId` instead of the role), `declarerSpitzen` (declarer only, while
declaring: spitzen for Grand and each suit, for the floor-value hint).

Which card fields each viewer gets: `hidden-information.md` §2.

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
