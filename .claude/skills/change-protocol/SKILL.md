---
name: change-protocol
description: Checklist for adding or changing a GameAction, TableCommand, TableView/GameView field or network message in WebSkat, across engine/table types, reducers, view redaction, zod schemas, PROTOCOL_VERSION, host snapshots, UI, i18n and tests. Use whenever data that crosses the network changes shape.
---

# Change a command, action, view field or message

Anything sent between browsers is typed in `src/engine`/`src/table`, validated by zod in
`src/net`, and versioned by `PROTOCOL_VERSION`. Miss one step and old/new browsers or the
redaction break. Background: `docs/networking.md` §3, `docs/hidden-information.md` §5.

## A. New or changed `GameAction` (engine)

1. `src/engine/types.ts`: add the variant to `GameAction` (and `Legal` in `game.ts` if the client
   needs permission info).
2. `src/engine/game.ts`: handle it in `applyAction` (phase check → role check → validation →
   new state); extend `getLegal` and `enumerateActions`.
3. Engine tests: flow, every error, immutability; `game.fuzz.test.ts` stays green.
4. Continue with C.

## B. New or changed `TableCommand` (table)

1. `src/table/types.ts`: add the variant; add new error codes to `TableErrorCode`.
2. `src/table/table.ts`: add the `case` in `applyCommand` (who may send it, when, effect). The
   `switch` must stay exhaustive.
3. `src/table/table.test.ts`: success, each error code, state unchanged on error.
4. Continue with C.

## C. Wire format (net)

1. `src/net/schemaGame.ts` (`GameActionSchema`, `TableCommandSchema`) or
   `src/net/schemaView.ts` (view/record schemas) or `src/net/protocol.ts` (message envelopes).
   Schemas are `z.ZodType<T>`: `npm run typecheck` shows drift. Optional fields in types that zod
   produces need `?: T | undefined`.
2. `src/net/constants.ts`: `PROTOCOL_VERSION` + 1. Note the new version in
   `docs/networking.md` §1. A protocol change is breaking: it makes the next release a **minor** one (major
   from 1.0.0 on); do not bump now, write "(protocol version N)" in the `CHANGELOG.md` item
   (`docs/dev/versioning.md`).
3. `src/net/protocol.test.ts`: a valid sample parses; malformed samples are rejected.
4. Host behavior beyond `applyCommand` (e.g. sending a message)? `src/net/host.ts` +
   `host.test.ts` with `createRig`/`joinClient`/`settle`.

## D. New or changed view field

1. `src/table/viewTypes.ts`: the field.
2. `src/table/view.ts` / `viewGame.ts`: fill it explicitly for each viewer (allow-list). Decide
   who may see it; card ids only per `docs/hidden-information.md` §2.
3. `src/table/view.test.ts`; if it can contain cards, extend `allowed()` in
   `view.redaction.test.ts`.
4. Do C (schema in `schemaView.ts`, version bump).

## E. State stored by the host

If `TableState` (or anything in `HostSnapshot`) changes shape, old snapshots in `localStorage`
must still load: migrate in `src/ui/persist/hosted.ts` (`loadHostSnapshot`) and test in
`hosted.test.ts`. Players' `GameRecord` caches are validated by `GameRecordSchema`; a changed
record shape needs a tolerant schema or a migration in `src/ui/persist/records.ts`.

## F. UI

1. Read permissions from `view.game.legal` / view fields; send with `connection.send(...)`.
2. Texts: keys in `en.ts` and `de.ts`, including `error.<CODE>` for every new error code.
3. `data-testid` for new controls (+ `docs/dev/e2e.md` §6); jsdom test.
4. Bots: if a new action can be legal for a bot, make sure `chooseBotAction` handles it
   (`src/table/bot/index.ts`) and `levels.test.ts` stays green.

## G. Finish

`npm run check`; `npm run e2e` for user-visible flows. Update `docs/engine.md` / `docs/table.md`
(§3 commands, §6 views), `docs/networking.md`, `docs/hidden-information.md` if visibility
changed, and add a `docs/decisions.md` row.
