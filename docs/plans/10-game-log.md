# Plan 10: Game log

User request: *"Create a game log that can be opened via a button in the top row similar to the
settings. The log should contain joins and disconnects of players, bidding updates, updates if
the game type is announced, updates if a game ended with the winner and points."*

Read first: `docs/table.md`, `docs/networking.md` §3–§5, `docs/hidden-information.md`,
`docs/ui.md` §3 and §10, `src/table/AGENTS.md`, `src/net/AGENTS.md`, `src/ui/AGENTS.md`, skill
`change-protocol`. Plans 01–09 must be done (the log covers replacements, Ramsch and Bock).

## 1. Current state (after plan 09)

- Nothing records what happened at a table except `GameRecord`s (finished games only). Clients
  only ever see the latest view, so a player who looks away misses bids, joins and drop-outs.
- Joins, token reconnects, invite takeovers and disconnects are handled by the host controller
  (`src/net/host.ts` `onJoin`, `onPeerLeave`) with `addPlayer` / `setConnected`; everything else
  goes through `applyCommand` (`src/table/table.ts`), also every bot action (`botStep`).
- Commands that change players: `kick`, `replace-player`, `leave`, `add-bot`. Game flow: `start`,
  `game` (bid/hold/pass/claim, pickup-skat, play-hand, discard, declare, play), `ready`,
  `abort-game`. A finished game creates a record in `finishGame` (with `bockTriggered`); the next
  game may be dealt in the same command (`tryDeal`).
- The top bar (`src/ui/components/TopBar.tsx`) has Stats, Players (plan 07), Settings, Leave.

## 2. Decisions (log them in `docs/decisions.md`)

1. *Where the log lives*: the host keeps it in `TableState.log` (authoritative, part of the host
   snapshot, so it survives a host reload), capped at the last 200 entries. Every view carries
   the last 100 entries (`TableView.log`); all players see the same log, including events from
   before they joined. No new message type.
2. *Entries are data, not text*: each entry has a `kind` and ids/names/numbers; the UI translates
   it. Names are stored in the entry so that it stays readable after a player left.
3. *What is logged*: joins (players and bots), reconnects, disconnects, leaving, kicks,
   replacements, each deal (game number, dealer, Bock), every bid/hold/pass/claim, Skat pickup or
   Hand, the declared game, Ramsch start, aborted games, results (winner, value, card points or
   Ramsch losers), and the start of Bock games. **Card plays and discards are not logged**: too
   noisy, and views may show only the current and the last trick (`hidden-information.md` §2).
4. *Who writes*: the table reducer derives entries for every command (`commandLog`), so bot
   actions are logged too; the host controller appends join/reconnect/disconnect entries with
   the pure helper `appendLog`.
5. *Protocol* version +1.

## 3. Steps

### Step 1: table: log types and helpers (tests first)

- New `src/table/log.ts`:
  ```ts
  export const LOG_LIMIT = 200;      // entries kept in TableState
  export const LOG_VIEW_LIMIT = 100; // entries sent in a view
  export type LogEvent =
    | { readonly kind: 'joined'; readonly playerId: PlayerId; readonly name: string; readonly isBot: boolean; readonly pending: boolean }
    | { readonly kind: 'reconnected' | 'disconnected' | 'left' | 'kicked'; readonly playerId: PlayerId; readonly name: string }
    | { readonly kind: 'replaced'; readonly playerId: PlayerId; readonly name: string; readonly byId: PlayerId; readonly byName: string }
    | { readonly kind: 'dealt'; readonly number: number; readonly dealerId: PlayerId; readonly dealerName: string; readonly bock: boolean }
    | { readonly kind: 'bid'; readonly playerId: PlayerId; readonly name: string; readonly action: 'bid' | 'hold' | 'pass' | 'claim'; readonly value: number | null }
    | { readonly kind: 'skat'; readonly playerId: PlayerId; readonly name: string; readonly pickedUp: boolean }
    | { readonly kind: 'declared'; readonly playerId: PlayerId; readonly name: string; readonly declaration: Declaration }
    | { readonly kind: 'ramsch' | 'aborted'; readonly number: number }
    | { readonly kind: 'result'; readonly number: number; readonly outcome: 'played' | 'passed-in' | 'ramsch';
        readonly declarerId: PlayerId | null; readonly declarerName: string | null; readonly declaration: Declaration | null;
        readonly won: boolean | null; readonly gameValue: number | null;
        readonly declarerPoints: number | null; readonly defenderPoints: number | null;
        readonly loserNames: readonly string[]; readonly durchmarschName: string | null }
    | { readonly kind: 'bock-started'; readonly games: number };
  export type LogEntry = LogEvent & { readonly n: number; readonly at: number }; // n: running number, at: ctx.now / now()
  /** Appends events with running numbers; keeps the last LOG_LIMIT entries. Does not call touch. */
  export function appendLog(s: TableState, events: readonly LogEvent[], at: number): TableState
  ```
  `n` = (`n` of the last entry, or 0) + 1, +1 per event. If TypeScript complains about the
  intersection with a union, write `LogEntry` as a distributive helper
  (`type WithMeta<T> = T extends unknown ? T & { … } : never`).
- `src/table/types.ts`: `TableState.log: readonly LogEntry[]` (import the type from `log.ts`).
  `createTable`: `log: []`.
- New `src/table/logEvents.ts`:
  `export function commandLog(before: TableState, after: TableState, actor: PlayerId, command: TableCommand, record: GameRecord | null): LogEvent[]`
  in this order:
  1. Command-specific:
     - `game` with `bid`/`hold`/`pass`/`claim` → `bid` (value for `bid`, 18 for `claim`, else null);
       `pickup-skat` → `skat` `pickedUp: true`; `play-hand` → `skat` `pickedUp: false`;
       `declare` → `declared` with `after.game.engine.declaration` (or the command's declaration);
       `discard`, `play` → nothing.
     - If the game entered Ramsch in this command (`before.game?.engine.ramsch !== true` and
       `after.game?.engine.ramsch === true` for the same game number) → `ramsch`.
     - `kick` → `kicked` (name from `before`); `leave` → `left`; `add-bot` → `joined` with the new
       bot (the player in `after` that is not in `before`), `isBot: true`;
       `replace-player` → `replaced` (names from `before`/`after`); `abort-game` → `aborted` with
       `before.game.number`.
     - `start`, `ready`, `set-rules`, `set-bot-level` → nothing here.
  2. `record !== null` → `result` (from the record; names from `record.names`; Ramsch
     `loserNames`/`durchmarschName` from `record.ramsch`); then, if `record.bockTriggered`,
     `bock-started` with `BOCK_GAMES`.
  3. `after.gameCounter > before.gameCounter` → `dealt` for the new game (`after.game.number`,
     dealer id/name, `after.game.bock`).
  Keep it < 300 lines; small helper per command kind.
- `src/table/table.ts`: rename the current exported function to a private `reduce(...)` and
  export
  ```ts
  export function applyCommand(s, actor, c, ctx): Outcome {
    const result = reduce(s, actor, c, ctx);
    if (!result.ok) return result;
    const events = commandLog(s, result.value.state, actor, c, result.value.record);
    return events.length === 0 ? result : ok({ ...result.value, state: appendLog(result.value.state, events, ctx.now) });
  }
  ```
- `src/table/viewTypes.ts` / `view.ts`: `TableView.log: readonly LogEntry[]` =
  `s.log.slice(-LOG_VIEW_LIMIT)`.
- `src/table/index.ts`: `export * from './log';` (net and ui need `appendLog`, `LogEntry`,
  `LOG_VIEW_LIMIT`).
- Tests `src/table/log.test.ts`:
  1. `appendLog` numbers entries, keeps the last 200, sets `at`.
  2. A scripted game on `tableWith(3)`: `start` → `dealt`; bids (use `enumerateActions` /
     `randomStep`, or known actions) → `bid` entries with the right ids and values; pickup →
     `skat`; declare → `declared`; finishing → `result` with winner, value and card points, then
     (if all ready) `dealt` of game 2.
  3. `kick`, `leave` (lobby), `add-bot`, `replace-player`, `abort-game` events.
  4. Ramsch rule on, everybody passes → three `bid` (pass) entries, then `ramsch`; later a
     `result` with `outcome: 'ramsch'`.
  5. A Bock trigger adds `bock-started` after the `result`.
  6. A bot-only table played with `runBots` produces a log (bots go through `applyCommand`).
  7. `viewFor(…).log` has at most 100 entries.
  The redaction test (`view.redaction.test.ts`) must stay green unchanged: the log holds no card
  ids. (Player names in tests must not look like card ids, e.g. not "SA".)
- Run: `npx vitest run src/table`.

### Step 2: host: join/reconnect/disconnect entries

- `src/net/host.ts` (watch the 300-line limit; helpers into `src/net/peers.ts` or a new
  `src/net/hostLog.ts` if needed):
  - new player added in `onJoin` → `appendLog(state, [{ kind: 'joined', playerId, name, isBot: false, pending: state.game !== null }], opts.now())`;
  - token reconnect and invite takeover → `reconnected` (only when the player was disconnected
    before, so a second tab does not spam the log);
  - `onPeerLeave` → `disconnected`, only if the player is still at the table and was connected.
  Each of these already ends with `broadcastViews()` + `persist()`; keep that order.
- Tests (`src/net/host.test.ts`, new `describe('log')`): join → the host view's `log` ends with
  `joined`; `net.drop` → `disconnected`; re-join with the token → `reconnected`; a client that
  sent `leave` produces `left` and no extra `disconnected` (it was removed).

### Step 3: wire format and snapshots

- New `src/net/schemaLog.ts`: `LogEntrySchema: z.ZodType<LogEntry>` (`z.discriminatedUnion('kind', …)`
  — one object per kind; group kinds with identical shapes using `z.enum([...])` for `kind`, or
  list them separately if the discriminated union needs literals; ids `z.string().min(1).max(64)`,
  names `z.string().min(1).max(40)`, `n`/`at`/numbers `z.number()`, declarations
  `DeclarationSchema`).
- `src/net/schemaView.ts`: `TableViewSchema.log: z.array(LogEntrySchema).max(LOG_VIEW_LIMIT)`.
- `src/net/constants.ts`: `PROTOCOL_VERSION` + 1 (expected 7).
- `src/ui/persist/hostedMigrate.ts`: missing `table.log` → `[]`; test in `hosted.test.ts`.
- `src/net/protocol.test.ts`: a view with one entry of every kind parses; an unknown kind and a
  log of 101 entries are rejected.

### Step 4: UI

- New pure `src/ui/log/logText.ts`: `logText(entry: LogEntry, t: Translator): string`, exhaustive
  `switch (entry.kind)` with `assertNever`-style `never` default. Uses `declarationLabel`
  (`src/ui/game/labels.ts`) for `declared`/`result`. Examples (en / de):
  - `log.joined`: "{name} joined" / "{name} ist beigetreten"; `log.joinedPending`: "{name} joined
    and waits for the next game" / "{name} ist beigetreten und wartet auf das nächste Spiel";
    `log.botAdded`: "Bot {name} was added" / "Bot {name} wurde hinzugefügt";
  - `log.reconnected`: "{name} is back" / "{name} ist wieder da"; `log.disconnected`: "{name} lost
    the connection" / "{name} hat die Verbindung verloren"; `log.left`: "{name} left the table" /
    "{name} hat den Tisch verlassen"; `log.kicked`: "{name} was removed" / "{name} wurde entfernt";
    `log.replaced`: "{by} took over the seat of {name}" / "{by} übernimmt den Platz von {name}";
  - `log.dealt`: "Game {number} — dealer: {name}" / "Spiel {number} — Geber: {name}";
    `log.dealtBock`: "Game {number} (Bock) — dealer: {name}" / "Spiel {number} (Bock) — Geber:
    {name}";
  - `log.bid`: "{name} bids {value}" / "{name} reizt {value}"; `log.hold`: "{name} holds" /
    "{name} sagt ja"; `log.pass`: "{name} passes" / "{name} passt"; `log.claim`: "{name} plays at
    18" / "{name} spielt mit 18";
  - `log.skatTaken`: "{name} picks up the Skat" / "{name} nimmt den Skat auf"; `log.hand`:
    "{name} plays Hand" / "{name} spielt Hand"; `log.declared`: "{name} announces {game}" /
    "{name} sagt {game} an"; `log.ramsch`: "Everybody passed: Ramsch" / "Alle haben gepasst:
    Ramsch"; `log.aborted`: "Game {number} was aborted" / "Spiel {number} wurde abgebrochen";
  - `log.won` / `log.lost`: "{name} won {game} ({value}), card points {declarer} : {defenders}" /
    "{name} gewinnt {game} ({value}), Augen {declarer} : {defenders}" (and "verliert"); for Null
    (no card points) `log.wonNull` / `log.lostNull` without the points part; `log.passedIn`:
    "Game {number}: everybody passed" / "Spiel {number}: alle haben gepasst";
    `log.ramschLost`: "Ramsch: {names} lost" / "Ramsch: {names} verliert"; `log.durchmarsch`:
    "Ramsch: Durchmarsch by {name}" / "Ramsch: Durchmarsch von {name}";
  - `log.bockStarted`: "60 : 60 — the next {games} games are Bock games" / "60 : 60 — die nächsten
    {games} Spiele sind Bockspiele";
  - dialog: `log.open`: "Log" / "Protokoll"; `log.title`: "Game log" / "Spielprotokoll";
    `log.empty`: "Nothing has happened yet." / "Noch nichts passiert."
  Keys go to `enPanels`/`dePanels` (or a new `parts/enLog.ts` + `deLog.ts` if a part would exceed
  300 lines; then add it to the spreads in `en.ts`/`de.ts` and the duplicate-key test).
- Test `src/ui/log/logText.test.ts`: one case per kind (English).
- New `src/ui/components/GameLogDialog.tsx` (+ `.module.css`, + test): modal like
  `SettingsDialog` (Esc and Close button). Props `{ entries: readonly LogEntry[]; onClose }`.
  `<ol data-testid="log-list">`, one `<li data-testid="log-entry">` per entry, oldest first, time
  `HH:MM` (`new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })`)
  in a muted column, `dealt` entries styled as separators (bold, top border). When the dialog
  opens and when new entries arrive, scroll the list to the bottom (`useEffect` on
  `entries.length` + a ref; `scrollTop = scrollHeight`). Empty → `log.empty`. Dialog content
  scrolls inside (`max-height: calc(100dvh - 16px)` like the other dialogs).
- `src/ui/components/TopBar.tsx`: button `data-testid="open-log"`, icon `📜`, label `log.open`,
  after Stats; opens `GameLogDialog` with `view.log` (live: the dialog re-renders with new views).
  At ≤ 600 px the bar now has five icon buttons; check 360 px width in the layout test. If the
  title gets too narrow, reduce `.right button` padding to `0 6px` and `.right` gap to `4px` in
  the narrow media block of `TopBar.module.css`.
- Test `GameLogDialog.test.tsx` (jsdom): renders entries in order with texts; Esc calls
  `onClose`; empty state.

### Step 5: docs

- `docs/table.md`: §1 `log`; §2 `appendLog`, `commandLog`; new section "Log" (event kinds, what is
  not logged, limits 200/100); §6 `TableView.log`. `src/table/AGENTS.md` file map (`log.ts`,
  `logEvents.ts`).
- `docs/hidden-information.md` §2: the log contains no card ids; plays and discards are never
  logged.
- `docs/networking.md`: §1 version 7; §4/§5 the host appends `joined`/`reconnected`/
  `disconnected`. `src/net/AGENTS.md` file map (`schemaLog.ts`).
- `docs/ui.md`: §3 TopBar (`open-log`), §10 `GameLogDialog`. `src/ui/AGENTS.md` file map
  (`log/logText.ts`, `components/GameLogDialog.tsx`).
- `docs/dev/e2e.md` §6: `open-log`, `log-list`, `log-entry`.
- `docs/dev/testing.md` §4; `docs/overview.md` §3 feature row; `README.md`.
- `docs/decisions.md`: rows from §2.

## 4. Validation

- `npm run check` green.
- `npx playwright test e2e/game.spec.ts e2e/layout.spec.ts e2e/reconnect.spec.ts`.
- Recommended e2e addition in `e2e/game.spec.ts`: after the game, a client opens `open-log` and
  sees at least one `log-entry` containing "joined" and one containing "won" or "lost" (English
  locale).
- Manual: `#/dev/local`, open the log during bidding: bids of the bots appear live.

## 5. Pitfalls

- Never log card ids (plays, discards, Skat cards, hands). The redaction property test would
  fail, and it would leak hidden information.
- `appendLog` must not be called for rejected commands (state unchanged on error).
- Keep the view small: only the last 100 entries travel with each view.
- The host's own `onPeerLeave` for a player who already left via `leave` must not add a second
  entry (the player is no longer at the table).
