# AGENTS.md — WebSkat

You are implementing **WebSkat**: a browser-only, peer-to-peer, multiplayer Skat card game
(3 players, optionally 4–6 players with "Geberskat" rules).

**The complete plan is in `docs/`. Read it before writing code. Do not invent rules or
architecture — follow the docs. If something is ambiguous, pick the simplest option, write the
decision into `docs/12-open-questions.md`, and continue.**

## 1. Reading order (mandatory)

1. `docs/00-overview.md` — goals, scope, decisions at a glance
2. `docs/01-tech-stack.md` — exact libraries and versions
3. `docs/02-architecture.md` — layers, folder layout, data flow, trust model
4. `docs/03-skat-rules.md` — **single source of truth for game rules and scoring**
5. `docs/04-game-engine.md` — types, state machine, function signatures, algorithms
6. `docs/05-networking.md` — transport, lobby, protocol messages
7. `docs/06-ui-ux.md` — screens, components, layout
8. `docs/07-statistics.md` — records and statistics
9. `docs/08-implementation-plan.md` — **the phase-by-phase task list you execute**
10. `docs/09-testing.md`, `docs/10-assets.md`, `docs/11-deployment.md`

Then read the `AGENTS.md` inside the folder you are working in (`src/engine`, `src/table`,
`src/net`, `src/ui`).

## 2. How to work

- Work **one phase at a time** in the order of `docs/08-implementation-plan.md`. Do not start a
  phase before the previous phase's acceptance criteria pass.
- Tick the checkboxes in `docs/08-implementation-plan.md` as you finish tasks.
- Write tests **first or together with** engine/table code. The engine is the part where bugs are
  most expensive.
- After each phase run `npm run check` (typecheck + lint + unit tests). It must be green.
- Make small, focused files (< 300 lines each). One concept per file.
- Do not commit or create git branches unless the user asks.
- Never modify or delete anything in `assets/` (originals). Generated files go to `public/`.

## 3. Hard rules (violating these is a bug)

1. **`src/engine` and `src/table` are pure TypeScript.** No `react`, no DOM, no `window`, no
   `localStorage`, no network, no `Date.now()`, no `Math.random()`. Time and randomness are
   injected by the caller (see `docs/04-game-engine.md`).
2. **All game logic lives in `src/engine` / `src/table`.** UI and network code never decide whether
   a move is legal; they only call the engine and render what it returns.
3. **The host browser is the only authority.** Clients send *commands*; the host validates them with
   the engine and broadcasts per-player *views*. Clients must never receive other players' hidden
   cards (see `docs/02-architecture.md`, "Hidden information").
4. **Validate all incoming network data** with the zod schemas in `src/net/protocol.ts` before it
   touches the engine.
5. **TypeScript strict mode, no `any`, no `@ts-ignore`.** Use discriminated unions and exhaustive
   `switch` statements (with a `never` check).
6. **State is immutable.** Engine functions return new state objects; never mutate arguments.
7. Rules/scoring numbers come from `docs/03-skat-rules.md`. Do not "improve" them.
8. Keep dependencies to those listed in `docs/01-tech-stack.md`. Ask (via open-questions doc) before
   adding another.

## 4. Commands (created in Phase 0)

```
npm install            # install deps
npm run dev            # vite dev server
npm run build          # production build into dist/
npm run preview        # serve dist/
npm run typecheck      # tsc -b --noEmit equivalent
npm run lint           # eslint
npm run test           # vitest run (unit tests)
npm run check          # typecheck + lint + test   <- run before declaring a phase done
npm run assets         # regenerate public/cards and public/backs from assets/
npm run relay          # local ws-relay signaling server for dev/e2e (optional strategy)
npm run e2e            # playwright multi-browser test (Phase 10)
```

Environment note: the planning machine had **no Node.js installed**. Verify `node -v` is
`>= 22.12` (Vite 8 / Vitest 5 requirement) before starting. If Node is missing, tell the user.

## 5. Glossary (German Skat terms used in code and docs)

| Term | Meaning |
|---|---|
| Vorhand / Mittelhand / Hinterhand | 1st / 2nd / 3rd active player after the dealer (`forehand`, `middlehand`, `hindhand` in code) |
| Reizen | bidding |
| Alleinspieler / declarer | the bidding winner, plays alone against the two defenders |
| Skat | the 2 face-down cards on the table |
| Drücken | discard 2 cards after picking up the Skat |
| Hand | declarer does not pick up the Skat |
| Ouvert | declarer plays with open cards |
| Schneider / Schwarz | loser has ≤ 30 points / loser took no trick |
| Grand | only the four Jacks (Buben) are trump |
| Null | declarer must take no trick |
| Spitzen | "with/without N" — count of consecutive top trumps |
| Eingepasst | everybody passed, game is not played |
| Geberskat | 4+ players: dealer (and others) sit out |

## 6. When you finish a phase

State briefly: what you built, which files, which tests pass. Do not claim "done" without running
`npm run check`.
