# AGENTS.md — `src/engine` (one Skat game, pure)

Read first: `docs/03-skat-rules.md` (rules + scoring vectors) and `docs/04-game-engine.md` Part A.

## Rules for this folder

- **Pure TypeScript.** No `react`, DOM, `window`, `localStorage`, network, `Date`, `Math.random`,
  `console` (except in tests). No module-level mutable state. Randomness only via `rng.ts` with an
  explicit seed.
- Imports: only from inside `src/engine`. Never import from `src/table`, `src/net`, `src/ui`.
- **Immutable**: every function returns new objects; never `push`/`splice`/assign on inputs. Use
  `readonly` types, spread, `filter`, `map`. Do not use `Object.freeze` tricks to "enforce" it.
- **Never throw** for bad input — return `Result` (`{ ok:false, error:{ code, message } }`).
  Throw only from `assertNever` in unreachable `switch` branches.
- Discriminated unions + exhaustive `switch` with a `default: return assertNever(x)`.
- JSON-serializable data only (no `Map`/`Set`/classes) so states can be stored and sent.
- Card ids are strings like `'CJ'`, `'S10'`, `'HA'`. `'10'` has two characters — use
  `id.slice(1)` for the rank, `id[0]` for the suit.
- Files < 300 lines, one concept per file, public API re-exported from `index.ts` only.
- **Numbers and formulas come from `docs/03-skat-rules.md`.** If your test disagrees with the
  doc, fix the code (or, if you believe the doc is wrong, write it in
  `docs/12-open-questions.md` and ask) — never silently change the doc's numbers.

## Test-first checklist

1. Copy the relevant table from `docs/03-skat-rules.md` into an `it.each` table.
2. Make it fail, then implement, then make it pass.
3. Every exported function has at least one test; reducers have an immutability test
   (`structuredClone` the input, run, expect input to deep-equal the clone).
4. Phase 2 ends with the fuzz test (`docs/09-testing.md` §2).

## Pitfalls

- Jacks are **not** part of their printed suit in suit games and Grand (`DJ` is trump, not a
  diamond). In **Null** they are ordinary cards between 10 and Q.
- The first bidder is the **middlehand** (caller), the forehand is the listener.
- Spitzen use the declarer's original 10 cards + the 2 Skat cards, even after discarding.
- `declarerPoints` includes the Skat/discarded cards; tricks count does not.
- Schneider/Schwarz flags for the multiplier are computed for **both** won and lost games.
- Declarer winning requires ≥ 61 (not 60). Schneider = `≥ 90` or `≤ 30`.
- Overbid: `gameValue < bid` ⇒ lost, loss uses `ceil(bid/base)*base` (suit/grand).
