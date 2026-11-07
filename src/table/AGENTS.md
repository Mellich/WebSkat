# AGENTS.md — `src/table` (many games at one table, pure)

Read first: `docs/04-game-engine.md` Part B, `docs/07-statistics.md`, `docs/02-architecture.md` §3.

## Rules for this folder

- **Pure TypeScript**, same purity rules as `src/engine` (no DOM, storage, network, `Date`,
  `Math.random`). Time and randomness arrive through `ctx: { now, seed }` or an injected `rand`.
- Imports: `src/engine` (via its `index.ts`) and `src/table` only.
- Everything is a **reducer**: `applyCommand(state, actorId, command, ctx)` returns
  `Result<{ state, record }>`. Never throw for invalid commands.
- The table maps **PlayerId ↔ Role** per game; the engine knows only roles. The actor of a
  `game` command must be one of `game.roles` values — otherwise `NOT_ACTIVE_PLAYER`.
- State is JSON-serializable and immutable.

## `view.ts` is the security boundary

- Build every `GameView` from an **allow-list**: start with empty fields and add only what the
  viewer may see (table in `docs/02-architecture.md` §3). Never copy the whole `ActiveGame` and
  delete fields.
- Never include `seed`, `initialHands`, other players' `hands`, or the Skat before it is public.
- The redaction property test (`docs/09-testing.md` §3) must exist and pass before you move on.

## Behavior reminders

- Dealer pointer (`nextDealerIdx`) advances **at deal time**, also for games that end passed-in
  or are aborted.
- `pending` players join the seat list only in `dealNext` (before computing roles).
- Records are created exactly once per finished game (`ActiveGame.recorded`).
- Score deltas: standard and Seeger both stored; Seeger lost-game bonus goes to **every other
  seated player** including sitting-out ones (`bonus(N)`: 40/30/24/20).
- Disconnected humans do not block `ready`; bots are always ready.
- `viewFor` for a stranger id (not seated, not pending) must not throw — return a minimal view
  with `you.role = 'lobby'` and no game info beyond public table data.
- Bots (`bot/`, Phase 13, `docs/14-bots.md`): strategies take a `BotView` only, never `GameState`.
  `botViewOf` is the single place that reads the game for a bot. Every bot action is checked against
  `enumerateActions`. Tuning constants live in `bot/tuning.ts`.
