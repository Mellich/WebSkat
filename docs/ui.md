# UI (`src/ui`)

React 19 function components, plain CSS modules, zustand stores. File map and folder rules:
`src/ui/AGENTS.md`. The in-game screen has its own doc: `ui-game-screen.md`.

**The UI never decides legality.** It enables exactly the cards and buttons that
`view.game.legal` allows and sends commands through the `GameConnection`.

## 1. Routes (`router.ts`, `App.tsx`)

No router library. `useRoute()` reads `location.hash` (`useSyncExternalStore`);
`navigate(hash)` sets it; `tableHash(key, invite?)` → `#/t/<KEY>` or `#/t/<KEY>?invite=<CODE>`.

| Hash | Route | Screen |
|---|---|---|
| `#/` or anything unknown | `home` | `screens/Home.tsx` |
| `#/t/ABCD-EFGH` (any case, dash optional) | `table` (key normalized, `invite` null) | `screens/TableScreen.tsx` |
| `#/t/ABCD-EFGH?invite=WXYZ-2345` | `table` with `invite` (normalized; an invalid code is ignored) | same; the invite is taken over, then dropped from the URL |
| `#/dev/local?seed=N&players=3..6&bots=easy\|normal\|strong` | `dev-local` | `dev/DevLocal.tsx` (DEV builds only, else Home) |
| `#/dev/gallery` | `dev-gallery` | `dev/Gallery.tsx` (DEV builds only, else Home) |
| `#/changelog` | `changelog` | `screens/ChangelogScreen.tsx` (all builds) |

`App` also renders `<Toasts />` (toasts vanish after 4.5 s or on click) and, on every route except
`changelog`, `<VersionBadge />`: `v<version>` fixed in the bottom left corner (`app-version`, small,
over the content without taking layout space). It is a link to `#/changelog` with
`target="_blank"`, so the changelog opens in a new tab and the game keeps running. The version is
`APP_VERSION` (`version.ts`, from `package.json` via Vite `define`; `dev/versioning.md`).

**Changelog screen** (`screens/ChangelogScreen.tsx`): title (`changelog.title`), current version
(`changelog.current`), then one panel per release of `CHANGELOG.md` (`changelog-release`), newest
first. The file is bundled with `?raw` (`changelog/changelogText.ts`) and parsed by
`changelog/parseChangelog.ts` (releases, Keep a Changelog sections, items; backticks → `<code>`).
Section titles are translated (`changelog.section.<Name>`); the items are shown as written in
`CHANGELOG.md` (English).

## 2. Home (`screens/Home.tsx`)

Top to bottom:
1. Logo (`public/skatastisches-logo.png`, `alt=""`) and title (`home.title`: "Skatastic Online
   Tournament System" / "Skatastisches Onlineturniersystem").
2. Name input (stored in settings; 1–20 chars; required for create/join).
3. "Rejoin" card when a client session (`webskat.session`) or host snapshots
   (`webskat.host.*`) exist: "Rejoin table KEY" and "Resume hosted table KEY" buttons.
4. **Create a table**: table name (default "<name>'s table", max 40) and "List publicly". No seat
   count, no bot strength. Calls `hostTable` and opens `#/t/KEY` (`create-table`).
5. **Join with a key**: input (`join-key-input`, upper-cased while typing) + optional invite code
   (`join-invite-input`, `home.inviteCode`) + Join (`join-submit`); invalid key → inline error
   `home.invalidKey`; invalid invite → `home.invalidInvite`; valid → `#/t/KEY?invite=CODE`.
6. **Public tables**: live list from `createDirectory` (`public-table` rows: name, host, seats
   `n/6`, `public-join` button). "Looking for public tables…" until the first ad arrives, then "No
   public tables found yet" when empty.
7. DEV only: link to `#/dev/local`.
8. Footer: trust note + About button (`AboutDialog`: how it works, trust, privacy).

Auto-rejoin: on the first Home render per page load, if the hash is empty and a client session
exists, Home navigates to that table (`decisions.md` I80).

## 3. Table screen (`screens/TableScreen.tsx`) and lobby (`screens/TableLobby.tsx`)

`TableScreen` for `#/t/KEY`:
- No stored name → a small name form, then join.
- Otherwise `openTable(key, name, invite)` once (§4), "Connecting…" until attached.
- With an invite, once `connected` the route is replaced by `#/t/KEY` (the used code leaves the
  URL, so a reload uses the new token).
- Always shows `TopBar` and, for non-`connected` statuses, a `connection-banner` (connecting,
  host lost, rejected with reason text, kicked, closed) with a Back/Leave button. A
  `rejected TIMEOUT` also shows **Retry** (`retry-join`): it drops the connection, and the effect
  joins again with the stored session. `INVITE_INVALID` has its own text.
- `TableLobby` shows the key, the seats (bot strength per bot for the host), the "Table rules"
  section (`lobby.rules`: the host's checkboxes `rule-ramsch` ("Ramsch when everybody passes") and
  `rule-bock` ("Bockrunden (60:60 → next 3 games count double)"); the others read "on"/"off"), and the host's Add bot / Start buttons. The rule checkbox is disabled while a
  game runs.
- Shows `TableLobby` while `view.table.status === 'lobby'`, the viewer is `pending`, or there is
  no game; otherwise `GameScreen` (keyed by game number, so each game starts with fresh local
  state). During a game the screen is fixed to `100dvh` and never scrolls.

`TopBar` (`components/TopBar.tsx`): table name, key, connection dot + text
(`connection-status`, `data-state` ok/wait/bad), buttons Stats (`open-stats`), Log (`open-log`, plan 10), Players
(`open-players`), Settings (`open-settings`), Leave (`leave-table`; asks for confirmation while a
game runs). On narrow or compact-landscape screens the buttons show icons only (📊 📜 👥 ⚙ ⎋) with
`aria-label`s.

`PlayersDialog` (`components/PlayersDialog.tsx`, Esc closes; split into `PlayerRow.tsx`,
`ReplaceChooser.tsx`, `InviteBox.tsx`): opened from the top bar with the live view and the
connection; `invite` is `host.invite` for the host and `null` for guests.
- Seats (`players-row-<seat>`): name, host and bot badges, role in the running game
  (`role.*`, "Sitting out"), online dot.
- Host, per non-host seat: during a running game **Replace** (`replace-<seat>`) → chooser
  (`replace-with`: each waiting player, or Bot; `replace-level` picks the strength when Bot is chosen, default normal;
  `replace-confirm` sends `replace-player`). Otherwise **Kick** (`players-kick-<seat>`, confirm dialog).
- Host, disconnected human: **Invite again** (`reinvite-<seat>`) → `invite-code` (formatted) and
  `invite-link` with copy buttons (`invite-copy-code`, `invite-copy-link`); `null` → `players.inviteFailed`.
- Every player, first block: the table's invite code and plain join link (`table-invite`,
  `InviteBox` with `idPrefix="table-invite"`: `table-invite-code`, `table-invite-link`, copy buttons
  `table-invite-copy-code` / `table-invite-copy-link`). The code is the table key, as in the lobby.
- Waiting players in `players-pending` with `players.pendingHint`.
- Host, running game: the abort button (`players-abort-game`, plan 03's `AbortGameButton`).

`TableLobby`:
- Key `ABCD-EFGH` (`table-key`) with Copy key / Copy link (clipboard API; not available on
  insecure origins).
- Seats `n/maxSeats` as a list (`seat-<i>`): number, name, ♛ host badge, bot badge, strength,
  online dot, Kick button (host, not for the host; confirm dialog).
- Bot strength: host gets a `<select>` per bot (`bot-level-<seat>`, Easy/Normal/Strong, sends
  `set-bot-level`); others see the level as text.
- Pending players listed below the seats (the Players dialog shows them too).
- Host: **Add bot** (`add-bot`, disabled when full or a game is running), **Start game**
  (`start-game`, enabled with ≥ 3 seated players or bots) + hint. Others: "Waiting for the host…"
  or, when pending, "You'll be seated when the current game ends".
- Info text about 3 players vs. Geberskat.

## 4. Wiring to the network (`net/actions.ts`, `net/transport.ts`)

| Function | Does |
|---|---|
| `getTransport()` | One Trystero transport per page, from `signalingConfigFrom(import.meta.env)` |
| `hostTable({hostName, tableName, isPublic})` | New key, `createTable` (host id `h<hex>`), `createHost` (with lobby, `Date.now`, `randomUint32`, debounced snapshot save), attaches it to the session store, returns the key |
| `openTable(key, name, invite = null)` | Host snapshot for the key → resume as host; else join as client: with an invite it takes over that seat (the stored token is ignored), otherwise with the stored token if the session is for this key |
| `resumeHostedTable(key)` | Resume from a snapshot (Home "Resume" button) |
| `leaveTable()` | Detach with `leave`: a client sends the `leave` command, the host stops the table; delete the host snapshot (host) or the client session |
| `startOnce(key, fn)` (internal) | Merges concurrent starts for one key (React StrictMode runs effects twice) |

Leaving sends the `leave` command (`GameConnection.leave()`), then closes the client room after
`LEAVE_CLOSE_DELAY_MS` (500 ms) so the command arrives first. In the lobby the host removes the seat
at once; during a running game the seat stays until the next deal. A host that leaves closes the
table (`closed` to everyone) and forgets its snapshot.

## 5. Stores (`store/`)

- `useSession` (`store/session.ts`): `key`, `connection`, `host` (when this browser hosts),
  `status`, `reason`, `view`, `records`, `toasts`; actions `attach`, `detach`, `toast`, `dismiss`.
  Updated only from `ConnectionEvent`s. Error events become toasts via `errorText(code, message)`.
  Records are cached per table key (`webskat.records.<KEY>`, last 500) and loaded on `attach`.
- `useSettings` (`store/settings.ts`): the settings of §6 + `update(patch)` (saves at once).
- Local UI state (selected card, open dialog, trick hold) stays in components and is never sent.

## 6. Settings (`persist/settings.ts`, `components/SettingsDialog.tsx`)

| Field | Values (default) | In the dialog |
|---|---|---|
| `name` | string ≤ 20 (`''`) | (Home input) |
| `language` | `en` \| `de` (browser: `de*` → de) | yes |
| `cardBack` | 0–3 (2) | yes, with previews |
| `confirmPlay` | `auto` (two taps on touch) \| `always` \| `never` (`auto`) | yes |
| `trickDisplayMs` | 0, 300, 600, 1000, 2000 (600) | yes (`setting-trick-display`, "Show finished trick") |
| `scoring` | `seeger` \| `standard` (`standard`) | yes (also the toggle in Stats; the result dialog reads it) |
| `bidBubbleMs` | 0, 500, 1000, 2000, 3000 (1000) | yes (`setting-bid-bubble`, "Show bids as speech bubbles"); each viewer's own, no host pacing |
Stored under `webskat.settings`, parsed with zod; invalid data → defaults. Migration: an old
`botDelayMs` value is copied to `trickDisplayMs`.

Motion follows the system setting (`prefers-reduced-motion` rule in `styles/global.css`); there is no app setting for it.

## 7. Persistence (`persist/`)

All `localStorage` access goes through `persist/storage.ts` (`browserStorage()`, null when
blocked) and the `persist/*` modules. Values are validated on read.

| Key | Module | Content |
|---|---|---|
| `webskat.settings` | `settings.ts` | settings (zod) |
| `webskat.session` | `session.ts` | `{key, name, token}` of the client seat (zod) |
| `webskat.host.<KEY>` | `hosted.ts` | `HostSnapshot` (shape guard `isTableState`; the `invites` field is optional, so old snapshots load). Upgrades live in `hostedMigrate.ts` (`migrateSnapshot`: the old table-wide `botLevel`) |
| `webskat.records.<KEY>` | `records.ts` | cached records, max 500 (zod) |

## 8. Dev screens (DEV builds only, lazy imports removed from production)

- `#/dev/local`: `startLocalTable` hosts a private table on the in-memory fake network with
  `players − 1` bots at level `bots`; you press Start. With `seed=N` every random value is N
  (same deal every game; an easy bot repeats its first choice). Used by `e2e/layout.spec.ts`.
- `#/dev/gallery`: all cards, backs, a hand with disabled cards, a trick, card chips.

## 9. i18n (`i18n/`)

- `en.ts` is the source dictionary (`as const`); `de.ts` is typed against it, so a missing or extra
  key is a compile error. Keys are flat with prefixes (`home.*`, `lobby.*`, `bid.*`, `declare.*`,
  `result.*`, `stats.*`, `settings.*`, `error.<CODE>`, `rank.*`, `rankShort.*`, `suit.*`, …).
- The dictionaries are split into `i18n/parts/`: `enApp.ts` / `deApp.ts` (app, common, home, about,
  table, lobby, topbar, error), `enGame.ts` / `deGame.ts` (cards, bidding, declarations, results,
  tricks, Skat, sitting out, bubbles, summary), `enPanels.ts` / `dePanels.ts` (stats, settings, bot
  strengths). `en.ts` and `de.ts` only merge them. A key belongs to exactly one part (tested).
- `useT()` returns `t(key, params)` bound to the current language; `{name}` placeholders.
  `translateNow` for non-React code.
- **Every visible string goes through `t`.** Add each key to both files.
- Card names: `cardName(card, t)` (full name, for `aria-label`/`title`), `cardShort` (chip text;
  German ranks B/D for Bube/Dame), `declarationLabel`, `spitzenLabel`, `suitSymbol`
  (`game/labels.ts`). `cardLabel` in `cardNames.ts` is an English fallback used as default prop.

## 10. Components and styling

| Component | Notes |
|---|---|
| `Card` | `<button>` when clickable or `disabled` (`disabled` prop: not clickable, `aria-disabled`), else `<img>`; states `normal`/`disabled` (grey overlay over an opaque face; never lower the face opacity)/`selected` (raised, `aria-pressed`)/`highlight`; sizes `hand`/`trick`/`opponent`; `testId` prop |
| `Hand` | sorted with `sortHand`; in an interactive hand every card is a button, non-`legal` cards (and all while `paused`) are `disabled`, looks unchanged for paused cards; `showAll` (bidding) shows all cards at full brightness; `--hand-n` CSS overlap |
| `ConnectionDot` | green dot (connected) or red dot (offline) with `aria-label` `connected`/`offline`; used by opponent seats, the lobby seat and pending lists, and the Players dialog |
| `OpponentSeat` | name, connection dot (`connected` prop), role, count badge, up to 10 backs (4 in compact layouts), ouvert cards face up, turn/declarer highlight (`opponent-seat`) |
| `TrickArea` | three fixed positions (`left`, `right`, `bottom`; `TrickPosition`), name label on each card, winner highlight, optional dismiss button (`trick-area`, `trick-dismiss`, `trick-slot-<pos>`) |
| `SpeechBubble` | bid bubble with a tail toward the speaker; positioned by `GameScreen` (`bid-bubble-*`), `aria-hidden` |
| `SkatPile` | two backs during bidding / Skat decision |
| `CardChip`, `CardChips` | card as text chip `♥10` with full name as `aria-label`/`title` |
| `GameLogDialog` (`components/GameLogDialog.tsx`, plan 10) | Modal over `view.log` (the last 100 entries, oldest first; `log-list` / `log-entry`, `dealt` entries are separators). Scrolls to the newest entry when one arrives. Texts from `log/logText.ts` (pure, one `switch` over the entry kinds; strings in `i18n/parts/enLog.ts` / `deLog.ts`). Closes on Esc |
| `TopBar`, `Toasts`, `ConfirmDialog`, `SettingsDialog`, `AboutDialog`, `PlayersDialog` | Dialogs close on Esc |
| `VersionBadge` | `v<version>` link bottom left on every screen, opens `#/changelog` in a new tab (§1) |
| `stats/*` | `statistics.md` §3 |

Styling: `styles/tokens.css` (palette, fonts, textures, `--card-w` etc.), `styles/global.css`
(oak background with grain, scratches, beer rings and smoke; buttons and text fields; includes a
`prefers-reduced-motion` rule), one `X.module.css` per component. The theme is a westphalian
Schänke (dark oak, worn baize table, brass accents); dark only. Headings use `--font-display`
(Pirata One, bundled as `public/fonts/PirataOne-latin-400.woff2` with its OFL text, `@font-face`
in `global.css`; serif fallbacks), text uses `--font-body`
(system sans). Panels are `--panel` with `--grain`; dialogs are `--panel-solid` with `--grain`; the card table is `--felt` on an oak rim.
Buttons are ≥ 44 px tap targets. Image URLs come from `assets.ts` (`cardUrl`, `backUrl`,
`logoUrl`, based on `import.meta.env.BASE_URL`). Card images are preloaded once per page when a
table opens (`preload.ts`), so tricks and open hands show without delay.
