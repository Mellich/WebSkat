# UI (`src/ui`)

React 19 function components, plain CSS modules, zustand stores. File map and folder rules:
`src/ui/AGENTS.md`. The in-game screen has its own doc: `ui-game-screen.md`.

**The UI never decides legality.** It enables exactly the cards and buttons that
`view.game.legal` allows and sends commands through the `GameConnection`.

## 1. Routes (`router.ts`, `App.tsx`)

No router library. `useRoute()` reads `location.hash` (`useSyncExternalStore`);
`navigate(hash)` sets it; `tableHash(key)` → `#/t/<KEY>`.

| Hash | Route | Screen |
|---|---|---|
| `#/` or anything unknown | `home` | `screens/Home.tsx` |
| `#/t/ABCD-EFGH` (any case, dash optional) | `table` (key normalized) | `screens/TableScreen.tsx` |
| `#/dev/local?seed=N&players=3..6&bots=easy\|normal\|strong` | `dev-local` | `dev/DevLocal.tsx` (DEV builds only, else Home) |
| `#/dev/gallery` | `dev-gallery` | `dev/Gallery.tsx` (DEV builds only, else Home) |

`App` also renders `<Toasts />` (toasts vanish after 4.5 s or on click).

## 2. Home (`screens/Home.tsx`)

Top to bottom:
1. Logo (`public/skatastisches-logo.png`, `alt=""`) and title (`home.title`: "Skatastic Online
   Tournament System" / "Skatastisches Onlineturniersystem").
2. Name input (stored in settings; 1–20 chars; required for create/join).
3. "Rejoin" card when a client session (`webskat.session`) or host snapshots
   (`webskat.host.*`) exist: "Rejoin table KEY" and "Resume hosted table KEY" buttons.
4. **Create a table**: table name (default "<name>'s table", max 40) and "List publicly". No seat
   count, no bot strength. Calls `hostTable` and opens `#/t/KEY` (`create-table`).
5. **Join with a key**: input (`join-key-input`, upper-cased while typing) + Join
   (`join-submit`); invalid key → inline error `home.invalidKey`.
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
- Otherwise `openTable(key, name)` once (§4), "Connecting…" until attached.
- Always shows `TopBar` and, for non-`connected` statuses, a `connection-banner` (connecting,
  host lost, rejected with reason text, kicked, closed) with a Back/Leave button.
- Shows `TableLobby` while `view.table.status === 'lobby'`, the viewer is `pending`, or there is
  no game; otherwise `GameScreen` (keyed by game number, so each game starts with fresh local
  state). During a game the screen is fixed to `100dvh` and never scrolls.

`TopBar` (`components/TopBar.tsx`): table name, key, connection dot + text
(`connection-status`, `data-state` ok/wait/bad), buttons Stats (`open-stats`), Settings
(`open-settings`), Leave (`leave-table`; asks for confirmation while a game runs). On narrow or
compact-landscape screens the buttons show icons only (📊 ⚙ ⎋) with `aria-label`s.

`TableLobby`:
- Key `ABCD-EFGH` (`table-key`) with Copy key / Copy link (clipboard API; not available on
  insecure origins).
- Seats `n/maxSeats` as a list (`seat-<i>`): number, name, ♛ host badge, bot badge, strength,
  online dot, Kick button (host, not for the host; confirm dialog).
- Bot strength: host gets a `<select>` per bot (`bot-level-<seat>`, Easy/Normal/Strong, sends
  `set-bot-level`); others see the level as text.
- Pending players listed below the seats.
- Host: **Add bot** (`add-bot`, disabled when full or a game is running), **Start game**
  (`start-game`, enabled with ≥ 3 seated players or bots) + hint. Others: "Waiting for the host…"
  or, when pending, "You'll be seated when the current game ends".
- Info text about 3 players vs. Geberskat.

## 4. Wiring to the network (`net/actions.ts`, `net/transport.ts`)

| Function | Does |
|---|---|
| `getTransport()` | One Trystero transport per page, from `signalingConfigFrom(import.meta.env)` |
| `hostTable({hostName, tableName, isPublic})` | New key, `createTable` (host id `h<hex>`), `createHost` (with lobby, `Date.now`, `randomUint32`, debounced snapshot save), attaches it to the session store, returns the key |
| `openTable(key, name)` | Host snapshot for the key → resume as host; else join as client with the stored token if the session is for this key |
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
| `webskat.host.<KEY>` | `hosted.ts` | `HostSnapshot` (shape guard `isTableState`; migrates the old table-wide `botLevel`) |
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
- `useT()` returns `t(key, params)` bound to the current language; `{name}` placeholders.
  `translateNow` for non-React code.
- **Every visible string goes through `t`.** Add each key to both files.
- Card names: `cardName(card, t)` (full name, for `aria-label`/`title`), `cardShort` (chip text;
  German ranks B/D for Bube/Dame), `declarationLabel`, `spitzenLabel`, `suitSymbol`
  (`game/labels.ts`). `cardLabel` in `cardNames.ts` is an English fallback used as default prop.
- Unused keys exist (`announce.played`, `announce.yourTurn`): there are no spoken play
  announcements yet; the status line is the `aria-live` region.

## 10. Components and styling

| Component | Notes |
|---|---|
| `Card` | `<button>` when clickable, else `<img>`; states `normal`/`disabled` (grey overlay over an opaque face; never lower the face opacity)/`selected` (raised, `aria-pressed`)/`highlight`; sizes `hand`/`trick`/`opponent`; `testId` prop |
| `Hand` | sorted with `sortHand`; only `legal` cards get handlers; `paused` keeps looks but removes handlers; `showAll` (bidding) shows all cards at full brightness; `--hand-n` CSS overlap |
| `OpponentSeat` | name, role, count badge, up to 10 backs (4 in compact layouts), ouvert cards face up, turn/declarer highlight (`opponent-seat`) |
| `TrickArea` | three slots, winner highlight, optional dismiss button (`trick-area`, `trick-dismiss`) |
| `SkatPile` | two backs during bidding / Skat decision |
| `CardChip`, `CardChips` | card as text chip `♥10` with full name as `aria-label`/`title` |
| `TopBar`, `Toasts`, `ConfirmDialog`, `SettingsDialog`, `AboutDialog` | Dialogs close on Esc |
| `stats/*` | `statistics.md` §3 |

Styling: `styles/tokens.css` (colors, `--card-w` etc.), `styles/global.css` (includes a
`prefers-reduced-motion` rule), one `X.module.css` per component. Dark green felt theme only.
Buttons are ≥ 44 px tap targets. Image URLs come from `assets.ts` (`cardUrl`, `backUrl`,
`logoUrl`, based on `import.meta.env.BASE_URL`). Card images are not preloaded.
