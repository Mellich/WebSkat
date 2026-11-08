# Plan 07: Replace seats during a game, Players dialog, re-invite by code or link

User request: *"Support for reconnects and replacement of disconnected players during a game with
freshly joined players: let the host replace a disconnected player seat with a player that is
waiting in the lobby. Allow kicking of players during the game and replacing them with players in
the lobby or bots. Support reinviting disconnected players via a code or link."*

Read first: `docs/table.md`, `docs/networking.md` (all), `docs/hidden-information.md`,
`docs/ui.md` §1–§4, skill `.claude/skills/change-protocol/SKILL.md`, `src/table/AGENTS.md`,
`src/net/AGENTS.md`, `src/ui/AGENTS.md`, `e2e/AGENTS.md`. Plans 03–06 must be done.

## 1. Current state

- A player who joins while a game is dealt goes to `TableState.pending` and is seated at the next
  deal (`addPlayer`, `dealNext`). "Waiting in the lobby" in the request = these pending players;
  `TableScreen` shows them the lobby screen.
- `kick` returns `GAME_RUNNING` during a running game (`src/table/table.ts` `kick()`). There is no
  way to change who holds a role in a dealt game ("A dealt game never changes its participants",
  `docs/table.md` §4).
- Reconnect today: a client keeps `{key, name, token}` in `localStorage['webskat.session']` and
  sends the token in `join`; the host re-binds the peer to the same player (`src/net/host.ts`
  `onJoin`). A player who lost the token (other device, cleared storage, or left via plan 03)
  cannot get the seat back.
- Host-only data lives in `src/net/host.ts`: `tokens` (token → player id), peer maps. The host
  browser's UI can reach its `Host` object through `useSession((s) => s.host)`.
- Lobby seat controls exist only in `TableLobby` (shown while no game runs). During a game the
  host has no player controls (plan 03 added only the contextual abort button).
- `host.ts` is 265 lines; `hosted.ts` (snapshot persistence) has one migration (`migrateBotLevel`).

## 2. Decisions (log them in `docs/decisions.md`)

1. *Replacing a seat*: new host command `replace-player { playerId, by }` with
   `by = { kind: 'pending', playerId } | { kind: 'bot', level }`. It is allowed at any time (lobby,
   running or finished game). The replacement takes the **same seat** and, in a dealt game, the
   same role / sitting-out slot / dealer slot; the engine state is unchanged. The replaced player
   is removed from the table (like a kick: gets `kicked`, its reconnect token is dropped). The
   score of the current game goes to whoever holds the seat when it is recorded; earlier records
   keep the old names. *Refines the rule "a dealt game never changes its participants": the
   roles never change, only the person holding one.*
2. *Kick during a game*: `kick` stays `GAME_RUNNING` while a game runs; kicking during a game is
   done with `replace-player` (the seat must be filled, so the game can go on).
3. *Hidden information on takeover*: the replacement sees exactly what the seat may see (its hand,
   and the Skat if it is the declarer while discarding/declaring).
4. *Invites*: the host can create an invite code for a **disconnected human** (not the host, not a
   bot). Code = 8 symbols of the table key alphabet (`ABCD-EFGH` format), single use, stored by the
   host (also in the host snapshot). A `join` with `invite` takes over that player's seat, gets a
   new token (old tokens of that player stop working). Unknown/used codes or a player who is no
   longer seated or already connected → `rejected` with reason `INVITE_INVALID`. Link format:
   `…#/t/ABCD-EFGH?invite=WXYZ-2345`; the code can also be typed on the start page.
5. *Invites are not table commands*: the host's UI calls `host.invite(playerId)` directly (the
   tokens live in the net layer; only the host browser can do it).
6. *Retry*: a client that got "Table not found or the host is offline" (`rejected TIMEOUT`) gets a
   Retry button that re-joins with the stored session.
7. *Protocol*: version +1 (new command, `join.invite`, new rejection reason).

## 3. Steps

### Step 0: make room (pure refactors, behavior unchanged)

1. `src/net/host.ts` → move peer bookkeeping into new `src/net/peers.ts`:
   `createPeerMap()` → `{ bind(peer, id), unbindPlayer(id), playerOf(peer), peerOf(id), dropPeer(peer): PlayerId | undefined }`
   (the logic of today's `bind`, `unbind` and the two maps). Move the lobby advertising
   (`advertise`, ad timer, `lobby.onPeerJoin`) into new `src/net/advertise.ts`:
   `startAdvertising({ lobby: Transport, getState: () => TableState, hostId, now }) → { stop(): void }`.
   `host.ts` uses both. Run `npx vitest run src/net` → green, unchanged tests.
2. `src/ui/persist/hosted.ts` → move `migrateBotLevel` into new
   `src/ui/persist/hostedMigrate.ts` as part of `export function migrateSnapshot(parsed: unknown): void`
   (mutates the parsed JSON in place, as today). `loadHostSnapshot` calls `migrateSnapshot`.
   Later plans add their migrations to this function. Run `npx vitest run src/ui/persist`.

### Step 1: table command `replace-player` (tests first)

- `src/table/types.ts`:
  ```ts
  export type ReplaceBy =
    | { readonly kind: 'pending'; readonly playerId: PlayerId }
    | { readonly kind: 'bot'; readonly level: BotLevel };
  // TableCommand gets:
  | { readonly type: 'replace-player'; readonly playerId: PlayerId; readonly by: ReplaceBy }
  ```
- New `src/table/replace.ts`:
  `export function replacePlayer(s: TableState, actor: PlayerId, target: PlayerId, by: ReplaceBy): Result<TableState, TableErrorCode>`
  - `actor !== s.hostId` → `NOT_HOST`; `target === s.hostId` → `CANNOT_KICK_HOST`;
    target not in `s.players` → `UNKNOWN_PLAYER`; `by.kind === 'pending'` and the id is not in
    `s.pending` → `UNKNOWN_PLAYER`.
  - New player: the pending player (removed from `pending`), or a bot
    `{ id: \`bot-${String(s.seq)}\`, name: uniqueName(allPlayers(s).map(p => p.name), 'Bot'), connected: true, isBot: true, botLevel: by.level }`.
  - `players`: same index, new player. `ready`: without `target`; plus the bot id if the game is
    finished.
  - `game` (if not `null`): `roles` with `target` → new id, `sittingOut` mapped, `dealerId`
    mapped. `engine`, `number`, `seed`, `recorded` unchanged.
  - `touch` once. (No dealer-pointer change: the seat index is the same.)
- `src/table/table.ts`: `case 'replace-player'`: call `replacePlayer`; on success
  `plain(tryDeal(result, ctx))` (a finished game may now be fully ready); on error
  `err(code, message)`. Keep `table.ts` < 300 lines.
- `src/table/index.ts`: export `replace.ts` only if `net`/`ui` need something from it (they need
  only the types, which come from `types.ts`).
- Tests `src/table/replace.test.ts`:
  1. 3 seated humans, game started; `cid` added with `addPlayer` → pending. Host replaces `p1`
     by pending `cid` → `players[1].id === 'cid'`, `pending` empty, `game.roles` has `cid` where
     `p1` was, `viewFor(s, 'cid').game.myHand` equals the engine hand of that role and
     `viewFor(s, 'cid').you.role` is that role; `viewFor(s, 'p1').you.role === 'lobby'`.
  2. Replace the player on turn by a bot → `botStep(s, …)` returns a new state (the bot acts).
  3. 4 seated, replace the sitting-out dealer → `sittingOut` and `dealerId` use the new id.
  4. Finished game, replace by bot → the bot is in `ready`; if every other connected human was
     ready, the next game is dealt.
  5. Lobby (no game): replace by bot works (seat count unchanged).
  6. Errors: not host, target is host, unknown target, target only pending, unknown pending id;
     state unchanged on every error.
- Run: `npx vitest run src/table`.

### Step 2: wire format

- `src/net/schemaGame.ts`, `TableCommandSchema`:
  `z.object({ type: z.literal('replace-player'), playerId: id, by: z.discriminatedUnion('kind', [z.object({ kind: z.literal('pending'), playerId: id }), z.object({ kind: z.literal('bot'), level: z.enum(['easy', 'normal', 'strong']) })]) })`
  (reuse `z.string().min(1).max(64)` for ids).
- `src/net/protocol.ts`: `JoinSchema` gets
  `invite: z.string().refine(isValidKey, { message: 'invalid invite' }).optional()`;
  `RejectedSchema.reason` adds `'INVITE_INVALID'`.
- `src/net/constants.ts`: `PROTOCOL_VERSION` + 1 (expected 4).
- `src/net/keys.ts`: `joinLink(key, base, invite?: string)` →
  `` `${base}#/t/${formatKey(key)}` `` plus `` `?invite=${formatKey(invite)}` `` when given.
- Tests: `protocol.test.ts` (replace-player parses; a bad `by.kind`, an invite `'0OOO-1111'` are
  rejected; join with a valid invite parses), `keys.test.ts` (`joinLink` with invite).

### Step 3: host: replacement notifications and invites (tests first)

- New `src/net/invites.ts`:
  ```ts
  export interface Invites {
    create(playerId: PlayerId): string;        // returns the existing code of that player or a new one
    take(code: string): PlayerId | null;       // single use: removes the code
    forget(playerId: PlayerId): void;          // drop codes of a removed player
    toJSON(): Record<string, PlayerId>;
  }
  export function createInvites(initial: Readonly<Record<string, PlayerId>>, newCode: () => string): Invites
  ```
  Codes are stored **normalized** (`normalizeKey`). Production `newCode` =
  `() => normalizeKey(generateKey(randomBytes))`.
- `src/net/host.ts`:
  - `HostSnapshot` gets `readonly invites?: Readonly<Record<string, PlayerId>>`; `HostOptions` gets
    `invites?` and `randomInvite?: () => string` (tests). `snapshot()` includes
    `invites: invites.toJSON()`.
  - `Host` gets `invite(playerId: PlayerId): string | null`: returns `null` unless the player is in
    `state.players`, `!isBot`, `id !== hostId`, `connected === false`; else `invites.create(id)`;
    then `persist()`.
  - `handleCommand`: replace the kick-only block by: for `kick` **and** `replace-player`, every id
    that was in `allPlayers` before and is not after → send `{ t: 'kicked' }` to its peer,
    `unbindPlayer(id)`, delete its tokens (`tokens`/`tokenOf`), `invites.forget(id)`.
  - `onJoin`, after the version check and **before** the token check:
    `if (msg.invite !== undefined)`: `id = invites.take(normalizeKey(msg.invite))`; the player
    must be in `allPlayers(state)`, not a bot, and `connected === false`; else send
    `{ t: 'rejected', reason: 'INVITE_INVALID' }` and return. On success: delete the player's old
    token(s), create a new token, `bind(peer, id)`, `state = setConnected(state, id, true)`, then
    continue with the normal welcome/records/views/persist tail.
  - Keep `host.ts` < 300 lines (that is why Step 0 exists).
- `src/net/client.ts`: `ClientOptions.invite?: string`; `sendJoin` adds `invite` while it is set;
  on the first `welcome` set the local `invite = undefined` (later re-joins use the token).
- Tests: new `src/net/invite.test.ts` (use `createRig` with a `randomInvite` option — extend
  `createRig` in `src/net/testing.ts` to pass `randomInvite: () => 'WXYZ2345'`-style codes):
  1. Anna joins, game started with Ben (3 players), `rig.net.drop('A')`, settle →
     `rig.host.invite(annaId)` returns a code; a new client `A2` joins with `invite` → same
     player id, a different token than before, connected again, its last view has 10 cards in
     `myHand`.
  2. The same code again → `rejected` `INVITE_INVALID`.
  3. `invite()` returns `null` for a connected player, the host and a bot.
  4. Anna's **old** token after the invite was used → treated as a new player (pending), not the
     seat.
  5. `host.snapshot().invites` contains an unused code; a new host created from that snapshot
     accepts it.
  6. Replacement over the network: Ben connected; Cid joins (pending); host
     `connection.send({ type: 'replace-player', playerId: benId, by: { kind: 'pending', playerId: cidId } })`
     → Ben's status `kicked`; Cid's view `you.role` is a role; no message to Cid contains another
     player's cards (`CARD_PATTERN`, see `integration.test.ts`).
- Run: `npx vitest run src/net`.

### Step 4: UI wiring for invites and retry

- `src/ui/router.ts`: table route becomes `{ kind: 'table'; key: string; invite: string | null }`;
  parse `?invite=` from the query of `#/t/KEY?invite=…` (valid when `isValidKey`, stored
  normalized). `tableHash(key, invite?)`. Update `router.test.ts`.
- `src/App.tsx`: `<TableScreen tableKey={route.key} invite={route.invite} />`.
- `src/ui/net/actions.ts`: `openTable(key, name, invite: string | null = null)`: a host snapshot
  still wins; otherwise with an invite → `attachClient(key, name, undefined, invite)` (ignore a
  stored token); `attachClient` passes `invite` to `createClient`. `startHost` passes
  `snapshot.invites` (resume) and `randomInvite` is the production default.
  `src/ui/persist/hosted.ts` `resumableSnapshot` keeps `invites`.
- `src/ui/screens/TableScreen.tsx`:
  - pass `invite` to `openTable`;
  - when `status === 'connected'` and `invite !== null` → `navigate(tableHash(tableKey))` (drops
    the code from the URL so a reload uses the new token);
  - `ConnectionBanner`: for `rejected` with reason `TIMEOUT` add a button
    `data-testid="retry-join"` (`t('table.retry')`) that calls `useSession.getState().detach()`;
    the existing effect then calls `openTable` again with the stored session.
  - `REJECTION_KEYS` gets `INVITE_INVALID` → `table.rejected.INVITE_INVALID`.
- `src/ui/screens/Home.tsx`, "Join with a key" form: optional second input
  `data-testid="join-invite-input"` (label `home.inviteCode`, placeholder `WXYZ-2345`,
  upper-cased while typing). On submit: empty → as today; invalid → message `home.invalidInvite`;
  valid → `navigate(tableHash(joinKey, invite))`. Update `Home.test.tsx`.
- i18n (`enApp`/`deApp`): `table.retry`: "Retry" / "Erneut versuchen";
  `table.rejected.INVITE_INVALID`: "This invite is not valid (anymore)." / "Diese Einladung ist
  (nicht mehr) gültig."; `home.inviteCode`: "Invite code (optional)" / "Einladungscode
  (optional)"; `home.invalidInvite`: "That is not a valid invite code." / "Das ist kein gültiger
  Einladungscode."

### Step 5: Players dialog (host controls during the game)

- New `src/ui/components/PlayersDialog.tsx` (+ `.module.css`, + `PlayersDialog.test.tsx`). Modal
  like `SettingsDialog` (Esc closes, Close button). Props:
  `{ view: TableView; connection: GameConnection; invite: ((playerId: string) => string | null) | null; onClose: () => void }`
  (`invite` is `null` for non-hosts). Content:
  1. Seated players (`players-row-<seat>`): name, host/bot badges, role in the current game
     (`role.*` texts, "Sitting out"), online dot (`lobby.connected` / `lobby.offline`).
  2. Host only, per non-host seat:
     - running game: **Replace** (`replace-<seat>`) → inline chooser: `<select data-testid="replace-with">`
       with one option per pending player (value = id) and "Bot" (value `bot`), and
       `replace-confirm` → sends `replace-player` (`by: { kind: 'bot', level: 'normal' }` for
       `bot`). Disabled options are not needed: the table validates.
     - no running game: **Kick** (`players-kick-<seat>`, ConfirmDialog, sends `kick`).
     - disconnected human: **Invite again** (`reinvite-<seat>`) → `invite(id)`; shows the code
       (`invite-code`, `formatKey`) and the link (`invite-link`,
       `joinLink(view.table.key, origin + pathname, code)`), each with a Copy button (clipboard
       pattern of `TableLobby.tsx`). If `invite` returns `null`, show `players.inviteFailed`.
  3. Pending players (`players-pending`) with the text `players.pendingHint` ("Seated when the
     next game starts, or when the host gives them a seat.").
  4. Host, running game: `AbortGameButton` (plan 03) — give it an optional `testId` prop and use
     `players-abort-game` here.
  Split a `PlayerRow.tsx` out if the file grows over ~250 lines.
- `src/ui/components/TopBar.tsx`: new button `data-testid="open-players"` (icon `👥`, label
  `players.open`) before Settings; opens `PlayersDialog` with
  `invite={host === null ? null : (id) => host.invite(id)}` where `host = useSession((s) => s.host)`.
  Check that the top bar still fits at 360 px width (icons only there).
- Tests (`PlayersDialog.test.tsx`, jsdom, fake `connection` with `send: vi.fn()`):
  host + running game → Replace → choose pending → confirm sends the right command; non-host
  sees no buttons; reinvite shows the formatted code returned by the `invite` prop; kick only
  without a running game.
- i18n (`enPanels`/`dePanels`): `players.open`: "Players" / "Spieler"; `players.title`;
  `players.replace`: "Replace" / "Ersetzen"; `players.replaceWith`: "Replace {name} with" /
  "{name} ersetzen durch"; `players.bot`: "Bot"; `players.confirm`: "Replace" / "Ersetzen";
  `players.kick` (reuse `lobby.kick` if you prefer); `players.reinvite`: "Invite again" /
  "Erneut einladen"; `players.inviteCode`: "Invite code" / "Einladungscode";
  `players.inviteLink`: "Invite link" / "Einladungslink"; `players.inviteFailed`: "Only
  disconnected players can be invited again." / "Nur getrennte Spieler können erneut eingeladen
  werden."; `players.pending`: "Waiting" / "Wartend"; `players.pendingHint` (see above).

### Step 6: host snapshot

- `src/ui/persist/hosted.test.ts`: a snapshot with `invites` loads and keeps them; an old one
  without `invites` still loads (field optional, no migration needed).

### Step 7: e2e

- New `e2e/replace.spec.ts` (title "replacing and re-inviting players"; reuse `e2e/helpers.ts`):
  1. Host Hanna + Anna + Ben, game started. Ben's context closes. Carl joins with the key (ends up
     pending, sees the lobby text). Hanna opens `open-players`, `replace-<seat of Ben>`, chooses
     Carl, `replace-confirm` → Carl sees 10 hand cards (`waitForHand`).
  2. Host + Anna + Ben, game started. Anna's context closes. Hanna opens Players,
     `reinvite-<seat>`, reads `invite-link`. A new context opens that link (after filling a name)
     → it sees 10 hand cards, and Hanna's Players dialog shows Anna online.
- Add the spec to `docs/dev/e2e.md` §3. Run `npx playwright test e2e/replace.spec.ts`.

### Step 8: docs

- `docs/table.md`: §2 `replacePlayer`; §3 new command row + `kick` note; §4 lifecycle wording
  (roles fixed, holder can change).
- `docs/hidden-information.md` §2/§3: takeover rule; invite codes are host-only secrets (like
  tokens) and travel only inside the invite link.
- `docs/networking.md`: §1 version history ("4: replace-player, join invite, INVITE_INVALID"); §3
  join/rejected; §4 joining order (version → invite → token → new); §5 `Host.invite`, snapshot
  `invites`, kicked notification for replace; §9 failure matrix rows ("player lost the token" →
  invite; "player gone for good" → replace); file map in `src/net/AGENTS.md` (`peers.ts`,
  `advertise.ts`, `invites.ts`, `invite.test.ts`).
- `docs/ui.md`: §1 route `?invite=`; §2 Home invite input; §3 TopBar `open-players`, Players
  dialog, Retry; §4 `openTable(key, name, invite)`; §7 snapshot field.
- `docs/dev/e2e.md` §6: `open-players`, `players-row-<i>`, `replace-<i>`, `replace-with`,
  `replace-confirm`, `players-kick-<i>`, `reinvite-<i>`, `invite-code`, `invite-link`,
  `players-pending`, `players-abort-game`, `retry-join`, `join-invite-input`.
- `docs/overview.md` §3 F9 (reconnect, replace, invite).
- `README.md`: a short "If a player drops out" paragraph.
- `src/table/AGENTS.md`, `src/ui/AGENTS.md` file maps; `docs/dev/testing.md` §3/§4.
- `docs/decisions.md`: rows from §2.

## 4. Validation

- `npm run check` green.
- `npx playwright test e2e/replace.spec.ts e2e/reconnect.spec.ts e2e/game.spec.ts`.
- `npx playwright test e2e/layout.spec.ts` (top bar has one more button).

## 5. Pitfalls

- The actor of `replace-player` is the sender's peer (as for every command); never trust ids in
  the payload for authorization.
- After a replacement, no message may reach the removed player's peer except `kicked`.
- Invite codes must not appear in any view, record or broadcast. They are only returned by
  `host.invite` to the host's own UI.
- `normalizeKey` the invite on both sides (links contain the dash).
- Do not let `replace-player` change the seat count, the dealer pointer, or the engine state.
