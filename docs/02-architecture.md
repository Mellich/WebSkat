# 02 — Architecture

## 1. Layers

```
┌────────────────────────────────────────────────────────────┐
│ src/ui      React screens, components, stores, i18n, CSS   │  impure (DOM, localStorage)
├────────────────────────────────────────────────────────────┤
│ src/net     Trystero transport, zod protocol, host & client│  impure (network, timers)
│             controllers, lobby directory                   │
├────────────────────────────────────────────────────────────┤
│ src/table   Table state: seats, dealer rotation, Geberskat,│  PURE TypeScript
│             game lifecycle, game records, stats, views, bot│
├────────────────────────────────────────────────────────────┤
│ src/engine  One Skat game: cards, deck, bidding, play,     │  PURE TypeScript
│             scoring                                        │
└────────────────────────────────────────────────────────────┘
        dependencies point DOWN only (ui → net → table → engine)
```

Import rules (enforced by ESLint `no-restricted-imports`):

- `engine` imports nothing from the project except itself.
- `table` imports `engine` only.
- `net` imports `table`, `engine` (types/helpers) – never `ui`.
- `ui` imports everything below, but only calls `engine`/`table` for *read-only helpers*
  (e.g. `sortHand`, `computeStats`, `cardPoints`). It never decides legality.

Purity rules for `engine` + `table`: no DOM, no `window`, no storage, no network, no `Date`,
no `Math.random`, no module-level mutable state. All inputs (seed, time) are parameters.

## 2. Folder layout

```
WebSkat/
  AGENTS.md  docs/  assets/  (originals, never modified)
  public/                     generated: cards/*.webp, backs/*.webp, favicon
  scripts/                    make-assets.mjs, relay.mjs
  e2e/                        Playwright tests
  src/
    main.tsx                  React bootstrap
    App.tsx                   screen switch (home | table)
    engine/
      AGENTS.md
      types.ts                Suit, Rank, CardId, Role, Declaration, GameState, GameAction, ...
      cards.ts                card constants, parse/format, cardPoints, sortHand
      rng.ts                  mulberry32 PRNG, seeded shuffle
      deck.ts                 buildDeck(), deal(seed)
      trump.ts                effectiveSuit(), cardStrength(), trickWinner(), legalCards()
      spitzen.ts              countSpitzen()
      values.ts               base values, BID_VALUES, nullValue(), game value formula
      bidding.ts              bidding state machine
      declaration.ts          validateDeclaration(), declarationOptions()
      play.ts                 playCard(), trick resolution
      scoring.ts              scoreGame() → GameResult
      game.ts                 newGame(), applyAction() (the single reducer), getLegal()
      index.ts                public API (re-exports)
      *.test.ts               unit tests next to the code
    table/
      AGENTS.md
      types.ts                TableState, Player, GameRecord, TableView, TableCommand, ...
      table.ts                createTable(), applyCommand() reducer
      rotation.ts             dealer rotation, active/sitting-out roles (Geberskat)
      records.ts              build GameRecord from a finished game (+ both scoring systems)
      stats.ts                computeStats(records, players) — pure aggregations
      view.ts                 viewFor(state, playerId) — redaction lives here
      bot.ts                  RandomBot: chooses a legal action
      index.ts
      *.test.ts
    net/
      AGENTS.md
      protocol.ts             zod schemas + inferred types for ALL messages
      transport.ts            Trystero wrapper (strategy selection, rooms, typed actions)
      host.ts                 HostController: owns TableState, applies commands, broadcasts views
      client.ts               ClientController: sends commands, receives views
      connection.ts           GameConnection interface (UI talks only to this)
      directory.ts            public-table advertising/browsing in the lobby room
      keys.ts                 table key generation/validation
      *.test.ts               tested with an in-memory FakeTransport
    ui/
      AGENTS.md
      screens/                Home, TableLobby, GameScreen
      components/             Card, Hand, OpponentSeat, TrickArea, BiddingPanel, ...
      stats/                  StatsPanel, Standings, History, ScoreChart
      store/                  session store (zustand), settings store
      persist/                localStorage helpers (zod-validated)
      i18n/                   en.ts, de.ts, t()
      styles/                 tokens.css, global.css, *.module.css
```

Keep files < 300 lines. One concept per file. Tests next to the code (`foo.ts` / `foo.test.ts`).

## 3. Host-authoritative model

```
 Client A (host)                       Client B                 Client C
┌──────────────────────┐        ┌───────────────┐        ┌───────────────┐
│ HostController       │◀──cmd──│ ClientCtrl    │        │ ClientCtrl    │
│  TableState (full)   │──view─▶│  last view    │        │  last view    │
│  engine + table      │◀──────────────cmd───────────────│               │
│  applyCommand()      │──────────────view──────────────▶│               │
│ + local ClientCtrl   │        └───────────────┘        └───────────────┘
└──────────────────────┘
```

1. The creator of a table is the **host**. Its browser holds the only authoritative `TableState`
   (including everyone's hands and the shuffle seed).
2. Every player (host included) interacts only through a `GameConnection` (see `05-networking.md`):
   `send(command)` and `subscribe(onView)`. The host's own connection is an in-process loop-back;
   remote players' connections go over Trystero.
3. Host receives a command → zod-validates it → `table.applyCommand(state, playerId, command, ctx)`
   → on success: new state; broadcast a **redacted `TableView` per player** (`viewFor`);
   on failure: send an `error` message to the sender only; state unchanged.
4. Clients never mutate game state. They render the last view they received.
5. The view contains everything the UI needs, including `legal` info for *the viewing player*
   (playable cards, bid options, …). The UI therefore never re-implements rules.

### Trust model (be explicit in the UI "About" text)

- Clients cannot cheat: they cannot play illegal cards, act out of turn, or see hidden cards.
- The **host can technically see all cards** (their browser has them). Players must trust the host,
  as when one friend shuffles at a real table. No mental-poker cryptography in v1.
- Messages are validated (zod) and attributed to a `playerId` bound to the Trystero peer connection
  at join time. Peers cannot send commands on behalf of other players because the host looks up the
  player by the **Trystero peerId of the message sender**, never by an id inside the payload.
- The table key is the only access control for private tables (≥ 40 bits of entropy, see `keys.ts`).

### Hidden information (MUST be enforced in `src/table/view.ts`)

A `TableView` for player P may contain card identities only for:

| Card set | Visible to |
|---|---|
| P's own hand | P |
| Declarer's hand when game is **ouvert** (after declaration) | everyone |
| The two Skat cards after the declarer **picked them up** (during discarding/declaring) | declarer only |
| Skat + discarded cards after the game is **finished** | everyone (shown in result) |
| Cards in the current trick and the last completed trick | everyone |
| Other players' hands | **nobody** — send only the **count** |
| Shuffle seed | nobody (host only; never in a view or record) |

There is a required property test (`09-testing.md` §3): random games, after every action, for every
viewer, assert that every card id occurring anywhere in `JSON.stringify(view)` is in the allowed set
above.

## 4. Data flow of one move (play a card)

```
UI click on card ──▶ connection.send({type:'game', action:{type:'play', card:'HJ'}})
   (UI only enables cards listed in view.game.legal.playableCards)
   host: zod parse ─▶ table.applyCommand ─▶ engine.applyAction ─▶ new TableState
   host: for each player p: transport.send('view', viewFor(state, p.id), target = p.peerId)
   host: local UI gets viewFor(state, hostId) directly
   clients: zod parse view ─▶ store.setView(view) ─▶ React re-renders
```

When a game finishes, `applyCommand` also returns the new `GameRecord`; the host appends it to
`state.records`, broadcasts `{type:'record', record}` to everyone (clients append it to their local
copy and recompute stats with `table/stats.ts`), and persists to `localStorage`.

## 5. Time and randomness

- Seed for each deal: `crypto.getRandomValues(new Uint32Array(1))[0]` generated in
  `src/net/host.ts` and passed in `ctx.seed`. The engine's `shuffle(seed)` is deterministic →
  tests can replay any game.
- Wall-clock time (`Date.now()`) is passed as `ctx.now` into `applyCommand` (only used for record
  timestamps).
- No game timers in v1 (no turn clock). UI-only animation timers are allowed in `src/ui`.

## 6. Error handling conventions

- Engine/table functions **never throw** for invalid input. They return
  `{ ok: false, error: { code, message } }` with a stable string `code` (e.g. `'NOT_YOUR_TURN'`,
  `'ILLEGAL_CARD'`). Throw only for programmer errors (`assertNever`).
- Result type (`src/engine/types.ts`):
  ```ts
  export type Result<T, E extends string = string> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: { readonly code: E; readonly message: string } };
  ```
- Network layer maps errors to `error` messages; UI shows a toast with the localized message for
  `code`.
