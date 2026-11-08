# Plan 03: Leave sends `leave`, the host can abort a game, leavers are removed at the next deal

User request: *"The UI never sends the leave or abort-game commands. A client that clicks Leave
just disconnects and stays seated until the host kicks it. Fix it to send the commands as
intended."*

Read first: `docs/table.md` §3–§4, `docs/networking.md` §6, `docs/ui.md` §3–§4,
`src/table/AGENTS.md`, `src/net/AGENTS.md`, `src/ui/AGENTS.md`, skill `change-protocol` (only for
orientation: **no wire format changes** in this plan).

## 1. Current state

- Table layer (`src/table/table.ts`): command `leave` exists (`leave()` ~line 212): pending →
  removed; seated + running game → only `setConnected(false)`; seated otherwise → removed (< 3 →
  lobby). Command `abort-game` exists (`abortGame()` ~line 175): host only, running game → `dealNext`.
- UI: `leaveTable()` (`src/ui/net/actions.ts` ~line 151) calls `useSession.getState().detach()`,
  which calls `connection.close()`. No command is sent. Nothing sends `abort-game`.
- Consequence: a client that leaves stays seated as "offline". `tryDeal` ignores disconnected
  humans, so the next game is dealt **with** the ghost seat and play stops on its turn
  ("Waiting for X to reconnect…"). The host can only kick between games.
- `GameConnection` (`src/net/connection.ts`) has `playerId`, `send`, `subscribe`, `close`.
  Implementations: the client in `src/net/client.ts`, the host loop-back in `src/net/host.ts`
  (~line 242).
- Trystero closes the peer connections on `room.leave()`. A command sent immediately before
  may be lost, so the client must wait a moment before leaving the room.

## 2. Decisions (log them in `docs/decisions.md`)

1. *Leave sends the command*: `GameConnection.leave()` sends `{ type: 'leave' }` to the host (if
   connected) and closes the connection after `LEAVE_CLOSE_DELAY_MS = 500` ms, so the command is
   delivered before the WebRTC connection closes. The host's `leave()` stops the host (closes the
   table), as Leave did before.
2. *Leaving during a running game*: the player is marked `leaving` and disconnected. The running
   game keeps the seat (the game waits on that player's turn, as before). The player is removed
   **when the next game is dealt** (`dealNext`, also via `abort-game`). If fewer than three
   players remain, the table goes back to the lobby. A player who reconnects before that (same id)
   is no longer `leaving`. *Supersedes the "only marked disconnected" part of I24.*
3. *Abort button*: the host sees an "Abort game" button in the status row while the player on turn
   is disconnected (`game.waitingFor !== null`), with a confirmation. (Plan 07 adds a general
   abort button to the Players dialog.)

## 3. Steps

### Step 1: table: `leaving` flag and removal at the next deal (tests first)

- New test file `src/table/leave.test.ts` (keep `table.test.ts` < 300 lines). Use `tableWith`,
  `ctxFor`, `playUntilRecords`, `randomStep` from `src/table/testing.ts`. Cases:
  1. Lobby: `p1` leaves → removed from `players` (existing behavior; keep as regression).
  2. Pending player leaves during a game → removed from `pending`.
  3. Running game (`tableWith(4)`, host sends `start`): `p1` leaves → still in `players`,
     `connected === false`, `leaving === true`; `state.game` unchanged.
  4. Same, then finish the game (`playUntilRecords(s, 1, …)`; disconnected humans do not block
     `ready`) → after the next deal `p1` is not in `players`; the dealer pointer still points at the
     same next dealer as `removePlayer` would compute (compare with
     `removePlayer(stateBeforeDeal, 'p1').nextDealerIdx`).
  5. 3 seated, `p1` leaves mid-game, game finishes and the others are ready → table back to
     `status: 'lobby'`, `game: null`, two players.
  6. `p1` leaves mid-game, then `addPlayer(s, { id: 'p1', name: 'Player 1' })` (reconnect) →
     `connected === true` and `leaving` is not `true`; after the next deal `p1` is still seated.
  7. Host aborts the game (`abort-game`) after `p1` left → the new game does not include `p1`.
  8. Error cases unchanged: host → `HOST_CANNOT_LEAVE`; unknown → `UNKNOWN_PLAYER`; state
     unchanged on error (`snapshot`/`toEqual` pattern from `docs/dev/testing.md` §2).
- `src/table/types.ts`, `Player`: add
  `readonly leaving?: boolean; // left during a running game; removed at the next deal`.
  Optional → old host snapshots need no migration.
- `src/table/seating.ts`:
  - `setConnected(s, id, connected)`: when `connected === true`, also reset `leaving` to `false`
    on that player (`{ ...p, connected, leaving: false }` only if `p.leaving === true`, else
    `{ ...p, connected }`).
  - New `markLeaving(s, id)`: `connected: false`, `leaving: true` (via `touch`).
  - New `removeLeavers(s)`: `removePlayer` for every player in `s.players` with
    `leaving === true` (fold over the ids; `removePlayer` keeps the dealer pointer right).
- `src/table/table.ts`:
  - `leave()`: running-game branch → `plain(markLeaving(s, actor))` instead of `setConnected`.
  - `dealNext(s, ctx)`: first line `const s0 = removeLeavers(s);` then use `s0` everywhere in
    the function (the existing "< 3 seated → lobby" branch then handles the too-few case).
  - Keep `table.ts` < 300 lines (`wc -l`).
- `src/table/view.ts`: no change (`leaving` is not part of `PlayerPublic`).
- Run: `npx vitest run src/table` (all table tests, incl. redaction and bots).

### Step 2: net: `GameConnection.leave()`

- `src/net/constants.ts`: `export const LEAVE_CLOSE_DELAY_MS = 500;`
- `src/net/connection.ts`, `GameConnection`: add
  `/** Leaves the table for good: tells the host (client) or closes the table (host). */ leave(): void;`
- `src/net/client.ts`: implement `leave()`:
  - if `closed` → return;
  - if `hostPeer !== null && !ended` → `room.send('cmd', cmdMessage({ type: 'leave' }), hostPeer)`;
  - set `ended = true` (never re-join);
  - `leaveTimer = setTimeout(() => { close(); }, LEAVE_CLOSE_DELAY_MS)`. Refactor the object's
    `close()` into a local `function close()` so both can call it; `close()` also clears
    `leaveTimer` (timers must be cleared, `src/net/AGENTS.md`).
- `src/net/host.ts`: add `leave: () => { stop(); }` to the loop-back `connection` (+2 lines;
  `host.ts` is 265 lines).
- Tests in `src/net/host.test.ts` (new `describe('leaving')`, `vi.useFakeTimers()`):
  1. Lobby: Anna joins, `settle`, `anna.connection.leave()`, `settle` → host `players` has no
     Anna. `vi.advanceTimersByTime(LEAVE_CLOSE_DELAY_MS)` → `statusOf(anna.events) === 'closed'`
     and `rig.net.members(tableRoom(KEY))` does not contain `'A'`.
  2. A client in `host-lost` (host peer gone) → `leave()` sends nothing and closes after the delay.
  3. `rig.host.connection.leave()` → Anna gets status `closed` (host stopped).
- Fix every other `GameConnection` object literal that the compiler now flags (search
  `grep -rn "GameConnection" src`); test doubles get `leave: () => undefined`.
- Run: `npx vitest run src/net`.

### Step 3: UI: Leave uses `leave()`

- `src/ui/store/session.ts`: `detach` gets a mode:
  `readonly detach: (mode?: 'close' | 'leave') => void;` → at the end
  `if (mode === 'leave') connection?.leave(); else connection?.close();`. `attach` keeps calling
  `detach()` (close) when switching tables.
- `src/ui/net/actions.ts`, `leaveTable()`: `detach('leave')`. Update the comment and the doc
  comment ("tells the host, then closes").
- Test (`src/ui/store/session.test.ts`): "tells the host when leaving": client attached, flush,
  `detach('leave')`, flush → `host.getState().players` has only the host. (Use fake timers or
  call `host.stop()` at the end so no timer is left.)
- i18n `topbar.leaveConfirm`: "Leave the table? Your seat stays empty until this game is over;
  then you are removed." / "Tisch verlassen? Dein Platz bleibt bis zum Ende dieses Spiels leer,
  dann wirst du entfernt."

### Step 4: UI: host abort button

- New component `src/ui/game/AbortGameButton.tsx` (+ test `AbortGameButton.test.tsx`):
  props `{ onAbort: () => void }`. Renders
  `<button type="button" data-testid="abort-game">{t('game.abort')}</button>`; a click opens
  `ConfirmDialog` (`src/ui/components/ConfirmDialog.tsx`) with `t('game.abortConfirm')`; confirm →
  `onAbort()` and close; cancel → close. Test: click → dialog; confirm calls `onAbort` once;
  cancel does not.
- `src/ui/game/GameScreen.tsx`: in the status row (`styles.statusRow`, next to the status text),
  render `<AbortGameButton onAbort={() => { connection.send({ type: 'abort-game' }); }} />` when
  `view.you.id === view.table.hostId && game.phase !== 'finished' && game.waitingFor !== null`.
- i18n: `game.abort`: "Abort game" / "Spiel abbrechen"; `game.abortConfirm`: "Abort this game? It
  is not scored, and the next game is dealt." / "Dieses Spiel abbrechen? Es wird nicht gewertet,
  und das nächste Spiel wird gegeben."
- Run: `npx vitest run src/ui`.

### Step 5: docs

- `docs/table.md`: §1 `Player` gets `leaving?`; §2 add `markLeaving`, `removeLeavers`, note in
  `dealNext` ("removes leavers first"); §3 `leave` row: "Seated + game running → disconnected and
  `leaving`; removed at the next deal"; §4 lifecycle: add the rule.
- `docs/networking.md`: §1 add `LEAVE_CLOSE_DELAY_MS`; §6 `GameConnection` gets `leave()`
  (client: send `leave`, close after 500 ms; host: stop); §9 failure matrix: "Client leaves".
- `docs/ui.md` §4: replace the paragraph "Leaving does **not** send the `leave` command …" with the
  new behavior; `leaveTable` row: "sends `leave` (client) / closes the table (host), forgets the
  seat or snapshot".
- `docs/ui-game-screen.md` §1 status area: the host's `abort-game` button and when it shows.
- `docs/overview.md` §2: delete the rows "`abort-game` command" and "`leave` command".
- `docs/dev/e2e.md` §6: add `abort-game` (Game row).
- `docs/dev/testing.md` §4: add `leave.test.ts`, `AbortGameButton`.
- `src/table/AGENTS.md`, `src/ui/AGENTS.md` file maps: new files.
- `docs/decisions.md`: rows from §2; mark I24 "*Partly superseded by I…*".

## 4. Validation

- `npm run check` green.
- `npx playwright test e2e/reconnect.spec.ts e2e/game.spec.ts` (Leave and reload flows).
- Recommended new e2e test (add to `e2e/reconnect.spec.ts`): host + Anna + Ben in the lobby; Ben
  clicks `leave-table` → the host's lobby shows 2 seats (`seat-2` disappears) within 15 s.

## 5. Pitfalls

- Never close the client room synchronously after sending `leave`: the command can be lost.
- `removeLeavers` must run **before** the seat count check in `dealNext`, and before pending
  players are seated, so pointer maths stays as in `removePlayer`.
- A kicked/closed client already has `ended = true`; `leave()` then only closes.
- `leaving` must not leak into `PlayerPublic` by accident (views are an allow-list; do not spread
  `Player`).
