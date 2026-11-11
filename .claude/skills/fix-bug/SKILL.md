---
name: fix-bug
description: Procedure for fixing a bug in WebSkat - reproduce deterministically (seeds, fake network, #/dev/local), locate the layer, write a failing regression test, fix the cause, run checks. Use when something behaves wrongly, a test fails, or the user reports a bug.
---

# Fix a bug in WebSkat

Full guide and pitfall list: `docs/dev/debugging.md`.

## 1. Reproduce

- UI: `npm run dev` → `#/dev/local?seed=N&players=3..6&bots=easy|normal|strong`. A seed makes
  every deal and bot choice repeat.
- Engine: `newGame(seed)` + `run(state, steps)` from `src/engine/testing.ts`.
- Table: `tableWith(n, { bots: true })`, `ctxFor(seed)`, `runBots` / `randomStep`
  (`src/table/testing.ts`).
- Network: `createRig()`, `joinClient(rig, 'P1', 'Anna')`, `settle(rig)` (`src/net/testing.ts`).
- Multi-browser or layout: an e2e spec (`docs/dev/e2e.md`).

## 2. Locate the layer

- State wrong (illegal move accepted, wrong score, wrong dealer)? → `src/engine` / `src/table`.
- Message missing, wrong player, reconnect broken? → `src/net`.
- State right but shown wrong? → `src/ui`. Compare the view (`useSession.getState().view`) with
  the screen.
- A card visible to the wrong player is a security bug → `src/table/viewGame.ts`
  (`docs/hidden-information.md`).

## 3. Regression test first

Write a test in that layer that fails because of the bug, named after the correct behavior. Run:
`npx vitest run <file> -t "<name>"`.

## 4. Fix the cause

- Fix where the wrong value is produced; never patch the UI around a wrong engine/table result.
- Never weaken a test, delete a property test, or change `docs/skat-rules.md` numbers to make a
  test pass. If the rules doc looks wrong, ask the user.
- Check `docs/dev/debugging.md` §3 (known pitfalls): Jacks, middlehand bids first, ≥ 61, key
  normalization, StrictMode double start, overlapping cards, hashed CSS class names.

## 5. Verify and report

1. The new test passes; `npm run check` is green.
2. `npm run e2e` if UI flow, layout or networking was involved.
3. Update docs if documented behavior changed; add a `docs/decisions.md` row for any choice.
4. `### Fixed` item under `## [Unreleased]` in `CHANGELOG.md` (`docs/dev/versioning.md`), no
   version bump; `npm run check` again.
5. Report cause, fix, test added, checks run.
