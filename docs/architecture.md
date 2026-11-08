# Architecture

## 1. Layers

```
┌──────────────────────────────────────────────────────────────┐
│ src/ui      React screens, components, stores, i18n, CSS,    │  impure (DOM, localStorage)
│             localStorage persistence, app wiring (actions)   │
├──────────────────────────────────────────────────────────────┤
│ src/net     transport (Trystero / in-memory fake), zod       │  impure (network, timers,
│             protocol, host + client controllers, lobby, keys │  Web Crypto)
├──────────────────────────────────────────────────────────────┤
│ src/table   one table: seats, dealer rotation, Geberskat,    │  PURE TypeScript
│             commands, records, statistics, views, bots       │
├──────────────────────────────────────────────────────────────┤
│ src/engine  one Skat game: cards, deck, bidding, play,       │  PURE TypeScript
│             scoring                                          │
└──────────────────────────────────────────────────────────────┘
      dependencies point DOWN only:  ui → net → table → engine
```

Import rules (ESLint enforces them, `tech-stack.md` §5):

| Layer | May import |
|---|---|
| `src/engine` | only itself |
| `src/table` | `src/engine` (via `../engine` = its `index.ts`) and itself |
| `src/net` | `src/table`, `src/engine` |
| `src/ui` | everything below. From `engine`/`table` only **read-only helpers** (`sortHand`, `declarationFloorValue`, `computeStats`, types, …). The UI never decides legality |

`src/main.tsx` mounts `<App />` (`src/App.tsx`), which picks the screen from the URL hash.

**Purity rules for `engine` and `table`:** no DOM, `window`, storage, network, `Date`,
`Math.random`, `console`, timers, or module-level mutable state. Time and randomness come in as
parameters (`ctx.now`, `ctx.seed`, `rand: () => number`). All state is immutable and
JSON-serializable (no classes, `Map`, `Set`, `Date`).

## 2. Top-level folders

```
AGENTS.md            entry point for agents (rules, commands)
README.md            user-facing readme (how to play, run, deploy)
docs/                these docs
assets/              original card/logo images. NEVER modify or delete
public/              static files; cards/ and backs/ are generated (git-ignored)
scripts/             make-assets.mjs, relay.mjs, publish-gh-pages.mjs
e2e/                 Playwright tests (own AGENTS.md)
src/main.tsx         React bootstrap
src/App.tsx          route → screen switch
src/engine/          pure: one game              (file map: src/engine/AGENTS.md)
src/table/           pure: one table, bots       (file map: src/table/AGENTS.md)
src/net/             networking                  (file map: src/net/AGENTS.md)
src/ui/              React UI                    (file map: src/ui/AGENTS.md)
.claude/skills/      task checklists for agents (implement-change, fix-bug, …)
```

Tests sit next to the code: `foo.ts` ↔ `foo.test.ts` (`dev/testing.md`). Files stay under 300
lines, one concept per file.

## 3. Host-authoritative model

```
 Browser A (host)                       Browser B                Browser C
┌──────────────────────┐        ┌───────────────┐        ┌───────────────┐
│ HostController       │◀──cmd──│ ClientCtrl    │        │ ClientCtrl    │
│  TableState (full)   │──view─▶│  last view    │        │  last view    │
│  table + engine      │◀──────────────cmd───────────────│               │
│  bots                │──────────────view──────────────▶│               │
│ + loop-back conn.    │        └───────────────┘        └───────────────┘
└──────────────────────┘
```

1. The creator of a table is the **host**. Only its browser holds the `TableState` (all hands,
   the seed).
2. Every player, the host included, talks to the game only through a `GameConnection`
   (`src/net/connection.ts`): `send(command)` and `subscribe(listener)`. The host's own connection
   is an in-process loop-back.
3. The host receives a command → zod-validates it → `applyCommand(state, actorId, command, ctx)`
   (`src/table/table.ts`). Success: new state, then a **redacted `TableView` per player**
   (`viewFor`). Failure: an `error` message to the sender only; state unchanged.
4. Clients never change game state. They render the last view.
5. The view contains `legal` for the viewing player (playable cards, bid options, …), so the UI
   never re-implements rules.

Trust model and visibility rules: `hidden-information.md`.

## 4. Data flow of one move

```
UI click on a card (enabled only if it is in view.game.legal.playableCards)
  → connection.send({ type: 'game', action: { type: 'play', card: 'HJ' } })
  client: room.send('cmd', { t: 'cmd', command }, hostPeer)
  host:   ClientMessageSchema.safeParse → actor = playerOf(senderPeerId)
        → applyCommand(state, actor, command, { now, seed }) → engine.applyAction
        → state replaced; new records broadcast; views sent per player; snapshot persisted
        → bot turns run synchronously, one botStep at a time, each followed by the same
          broadcast + persist, until a human must act
  client: HostMessageSchema.safeParse → emitter → useSession store (view) → React re-renders
```

When a game finishes, `applyCommand` appends a `GameRecord` to `state.records`. The host sends
`{ t: 'record' }` to all peers and gives its own listeners the full list (`records` event).
Clients append it, cache it in `localStorage`, and compute statistics with `computeStats`.

## 5. Time and randomness

- Deal seed: `randomUint32()` (`src/net/random.ts`, Web Crypto), passed by the host as `ctx.seed`
  for every command. The engine's shuffle is deterministic: same seed → same deal.
- Bots: the host creates `mulberry32(randomSeed())` once per batch of bot turns.
- Wall clock: `Date.now()` passed as `ctx.now` (only used for record timestamps).
- In `#/dev/local?seed=N` every random value is `N`, so deals and bot choices repeat.
- No turn timers. UI-only timers (trick display, toasts, copy feedback) live in `src/ui`.

## 6. Error handling

- Engine and table functions **never throw** for invalid input. They return
  `Result<T, E>` = `{ ok: true, value }` or `{ ok: false, error: { code, message } }` with a stable
  `code` (helpers `ok()`, `err()` in `src/engine/types.ts`). Throwing is only for programmer errors
  (`assertNever`, `rolesForDealer` with < 3 players, a rejected bot action).
- Error codes: `GameErrorCode` (`engine.md` §6) and `TableErrorCode` (`table.md` §3).
- The host sends `{ t: 'error', code, message }` to the sender. The UI shows a toast with
  `t('error.<CODE>')`, falling back to the host's message (`src/ui/store/session.ts` `errorText`).
- Switches over unions are exhaustive: `default: return assertNever(x)` (or a `never` variable).
