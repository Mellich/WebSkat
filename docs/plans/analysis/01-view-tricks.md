# Step 01: finished games show every trick (`GameView.tricks`)

**Kind:** protocol change (view field). **Layers:** table, net, ui fixtures.
**Protocol:** `PROTOCOL_VERSION` +1 (10 → 11 today; bump from the value you find).

## Read first

- `docs/hidden-information.md` §2 and §5, `docs/table.md` (views section), `docs/networking.md` §1, §3
- `src/table/AGENTS.md` ("view.ts / viewGame.ts are the security boundary")
- skill `change-protocol` (`.claude/skills/change-protocol/SKILL.md`)

## Why

The replay needs the order in which the cards were played. Today a finished `GameView` has the
dealt hands (`initialHands`), the Skat and the discard, but only the **last** trick (`lastTrick`).
Once a game is finished every dealt card is public, so the full trick list reveals nothing new.

## Goal

```ts
// src/table/viewTypes.ts, in GameView, directly after lastTrick
readonly tricks: readonly ViewLastTrick[] | null; // every completed trick, everybody when finished, else null
```

- `null` while `engine.phase !== 'finished'`.
- When finished: every entry of `engine.tricks` in order, mapped like `lastTrick`
  (`leaderId`, `plays[{ playerId, card }]`, `winnerId`). Passed-in games: `[]`.
  A Null game that ended early has fewer than 10 tricks; that is fine.

## Tests first

1. `src/table/view.test.ts`, new `describe('tricks')`:
   - running game (after a few plays): `view.game.tricks` is `null` for every viewer;
   - finished played game (use `finishedGame` / `GRAND_144` from `src/table/fixtures.ts`, or play
     a seed to the end with `playUntilRecords` from `src/table/testing.ts`): `tricks` has the same
     length as `engine.tricks`, the plays map role → player id, `winnerId` matches, and it is the
     same for every viewer (seated, sitting out, stranger);
   - the last entry equals `lastTrick`.
2. `src/table/view.redaction.test.ts`: no change needed. Its oracle already allows every trick card
   of a finished game. It must stay green; run it.
3. `src/net/protocol.test.ts` (or the test that parses a full `TableView` with
   `TableViewSchema`/the view schema): a finished view with `tricks` parses; a view with
   `tricks: [{ leaderId, plays: [{ playerId, card: 'XX' }], winnerId }]` is rejected.

Run: `npx vitest run src/table/view.test.ts src/table/view.redaction.test.ts src/net`

## Implementation

1. `src/table/viewTypes.ts`: add the field (above).
2. `src/table/viewGame.ts` in `gameViewFor`, next to `lastTrick`:
   ```ts
   tricks: e.phase === 'finished'
     ? e.tricks.map((t) => ({ ...trickView(t.plays, t.leader), winnerId: idOf(t.winner) }))
     : null,
   ```
   Keep the allow-list style: no spreading of engine objects other than the `trickView` result.
3. `src/net/schemaView.ts`, in the game view schema after `lastTrick`:
   ```ts
   tricks: z.array(TrickSchema.extend({ winnerId: id })).nullable(),
   ```
   (The schema is typed `z.ZodType<TableView>`, so the compiler tells you if it is missing.)
4. `src/net/constants.ts`: `PROTOCOL_VERSION` +1.
5. Fix every other `GameView` literal so it compiles. Find them with
   `grep -rln "declarerSpitzen:" src e2e` (today: `src/ui/game/viewFixtures.ts`,
   `src/ui/game/trickPositions.test.ts`). Add `tricks: null` (running game fixtures) or a fitting
   list for finished fixtures (`finishedGameFixture` may use `tricks: []` unless a test needs more).
6. Host snapshots (`src/ui/persist/hosted.ts`) do **not** change: `TableState` is unchanged.

## Docs

- `docs/hidden-information.md` §2: add a row "Every completed trick of a **finished** game |
  everyone | `game.tricks` (null while the game runs)".
- `docs/table.md` views section: describe `tricks`.
- `docs/networking.md` §1: version history line "11: finished views carry every trick
  (`GameView.tricks`, game analysis)".
- `docs/decisions.md`: new `I` row "Finished views carry every trick" (README §3).

## Done when

- `npm run check` is green.
- `wc -l src/table/viewGame.ts src/net/schemaView.ts` both < 300.
