# Debugging and fixing bugs

## 1. Procedure

1. **Reproduce.** Get exact steps. Prefer a deterministic reproduction:
   - UI: `npm run dev`, open `#/dev/local?seed=N&players=3..6&bots=easy|normal|strong`. With a seed
     every deal (and every bot choice) repeats.
   - Pure logic: a test with a fixed seed (`newGame(seed)`, `tableWith(n, {bots:true})`,
     `ctxFor(seed)`, `mulberry32(seed)`).
   - Network: `createRig` + `joinClient` + `settle` on the fake network (`src/net/testing.ts`).
2. **Locate the layer** (table in `dev/workflow.md` §1). Ask: is the state wrong (engine/table),
   is the message wrong or missing (net), or is the state right but shown wrong (ui)? Check the
   view: in a jsdom test or the console, compare `useSession.getState().view` with what the
   screen shows.
3. **Write a failing test** in that layer that shows the bug. Name it after the behavior
   ("keeps the dealer pointer when a seat before it is removed").
4. **Fix the cause**, not the symptom. Never make the UI compensate for a wrong engine/table
   result. Never weaken a test or a property test to make it pass.
5. `npm run check`; plus `npm run e2e` if UI flow, layout or networking was involved.
6. If the fix changes documented behavior, update the doc; if it involved a choice, add a row to
   `decisions.md`.

## 2. Reading check failures

| Failure | Typical cause | Fix |
|---|---|---|
| `tsc`: `Object is possibly 'undefined'` | `noUncheckedIndexedAccess` | handle `undefined` (`?? fallback`, early return) |
| `tsc`: type `undefined` not assignable with an optional field | `exactOptionalPropertyTypes` | conditional spread `...(x === undefined ? {} : { x })`, or type the field `?: T \| undefined` (needed for zod-inferred types) |
| `tsc`: `Cannot find name 'window'/'console'` in engine/table | `tsconfig.core.json` has no DOM | move the code to `src/ui`/`src/net`, or pass the value in |
| `tsc`: missing property in `de.ts` | key added only to `en.ts` | add the German text |
| `tsc`: schema not assignable to `ZodType<…>` | zod schema and TS type drifted | update `src/net/schema*.ts` |
| ESLint `no-restricted-globals` / `no-restricted-imports` | impure code or wrong layer import | inject the value / move the code |
| ESLint `switch-exhaustiveness-check` | new union member | add the `case` |
| ESLint `restrict-template-expressions` | number in a template string | `String(n)` |
| ESLint react-hooks | hook rules | follow the rule; do not disable it |
| Test fails only in jsdom | missing `// @vitest-environment jsdom` or `matchMedia` absent | add the pragma; guard browser APIs with try/catch (see `isCoarsePointer`) |

## 3. Known pitfalls (each one caused a real bug)

- **Jacks** are trump and not part of their printed suit in suit games and Grand (`DJ` is not a
  diamond). In Null they are normal cards between 10 and Q.
- The first bidder is the **middlehand**, not the forehand. `newGame` starts with
  `turn = 'middlehand'`.
- Spitzen use the declarer's original 10 cards + the 2 Skat cards, regardless of the discard.
- The declarer needs ≥ **61**; Schneider is ≥ 90 or ≤ 30; Schneider/Schwarz count for lost games
  too; overbid loss uses `ceil(bid / base) × base`.
- The dealer pointer moves at deal time (also for passed-in and aborted games).
- Table keys are stored **normalized** (`ABCDEFGH`) and shown formatted (`ABCD-EFGH`).
  `generateKey` returns the formatted form; normalize before storing (`decisions.md` I55).
- **React StrictMode** runs effects twice in development. Starting a host/client twice opens two
  connections; `startOnce` in `src/ui/net/actions.ts` prevents that.
- **Trystero rooms are shared per id** in one tab; the transport counts handles (I87). Do not call
  Trystero's `joinRoom` directly.
- Hand cards **overlap**: only the left edge is clickable. Tests click `{x: 6, y: 40}`.
- CSS-module class names are hashed: test selectors use `[class*="name"]`.
- `?seed=N` in `#/dev/local` fixes *every* random value, so every deal is the same and an easy
  bot repeats its first choice.
- A client that leaves via the UI only disconnects; it stays seated until kicked (`ui.md` §4).
- Kicked/closed clients must not re-join automatically (`decisions.md` I82).
- A host snapshot write can fire after Leave; `forgetHostSnapshot` cancels pending writes (I83).

## 4. Tools

- `#/dev/local` offline practice (DEV): no WebRTC, the in-memory network, bots.
- `#/dev/gallery` (DEV): all cards, backs, chips, a hand and a trick for visual checks.
- e2e traces and screenshots in `test-results/` (`dev/e2e.md` §2).
- Engine errors carry a stable `code`; the UI toast text is `error.<CODE>` from the i18n files.
- Host side: `createHost(...).getState()` returns the full `TableState` (tests, dev).
