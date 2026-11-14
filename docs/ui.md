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
| `#/analysis?g=<base64url>` | `analysis` (`data` = the raw `g` value or null) | `analysis/AnalysisScreen.tsx`, lazy (all builds). The link carries the whole finished game (`analysis/link.ts`, validated by `analysis/inputSchema.ts`); no storage or network. Step 05 stub, the screen is filled in step 07 (`docs/plans/analysis/`) |

`App` also renders `<Toasts />` (toasts vanish after 4.5 s or on click) and, on every route except
`changelog`, `<VersionBadge />`: `v<version>` fixed in the bottom left corner (`app-version`, small,
over the content without taking layout space). It is a link to `#/changelog` with
`target="_blank"`, so the changelog opens in a new tab and the game keeps running. The version is
`APP_VERSION` (`version.ts`, from `package.json` via Vite `define`; `dev/versioning.md`).

**Changelog screen** (`screens/ChangelogScreen.tsx`): title (`changelog.title`), current version
(`changelog.current`), then one panel per release of `CHANGELOG.md` (`changelog-release`), newest
first. The file is bundled with `?raw` (`changelog/changelogText.ts`) and parsed by
`changelog/parseChangelog.ts` (releases, Keep a Changelog sections, items; backticks → `<code>`).
Both the changelog screen (`App.tsx`) and the Stats dialog (`TopBar.tsx`) are `React.lazy` imports, so
their code is a separate chunk loaded on first use; keeps the main bundle under the 500 kB warning limit.
Section titles are translated (`changelog.section.<Name>`); the items are shown as written in
`CHANGELOG.md` (English).

## 2. Home (`screens/Home.tsx`)

Top to bottom:
1. Logo (`public/skatastisches-logo.png`, `alt=""`) and title (`home.title`: "Skatastic Online
   Tournament System" / "Skatastisches Onlineturniersystem").
2. Name input (stored in settings; 1–20 chars; required for create/join).
3. "Rejoin" card when a client session (`webskat.session`) or host snapshots
   (`webskat.host.*`) exist: "Rejoin table KEY" and "Resume hosted table KEY" buttons.
4. **Create a table**: table name (default "<name>'s table", max 40), "List publicly". No seat count, no bot strength. Calls `hostTable` and opens `#/t/KEY` (`create-table`).
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
  section (`lobby.rules`: the host's switches `rule-ramsch` ("Ramsch when everybody passes") and
  `rule-bock` ("Bockrunden (60:60 → next 3 games count double)") and `rule-kontra` ("Kontra and Re (doubling after the declaration)"); the others read "on"/"off"), and the host's Add bot / Start buttons. The rule switch is disabled while a
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

The dialog has two tabs (`Display`: language, card back, trick and bid timing; `Play`: "Playing a
card" and scoring). Language, "Playing a card" and scoring are `SegmentedControl`s; the two timing
settings stay selects. Every change is saved at once.

| Field | Values (default) | In the dialog |
|---|---|---|
| `name` | string ≤ 20 (`''`) | (Home input) |
| `language` | `en` \| `de` (browser: `de*` → de) | yes |
| `cardBack` | 0–3 (2) | yes, with previews |
| `confirmPlay` | `auto` (two taps on touch) \| `always` \| `never` (`auto`) | yes (`setting-confirm`, segmented, tab Play) |
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
| `Dialog` (`components/Dialog.tsx`) | Shared shell of every modal (`SettingsDialog`, `AboutDialog`, `GameLogDialog`, `PlayersDialog`, `StatsPanel`): title bar with an icon close button (×, `dialog-close`, `aria-label` "Close"), optional `actions` (buttons left of ×) and `toolbar` (non-scrolling row for tabs and segmented controls), scrolling body. Esc closes. Sizes `sm`/`md`/`lg` |
| `Tabs` (`components/Tabs.tsx`) | Tab row for switching the content of a dialog: `role="tablist"`, roving tabindex, Left/Right/Home/End keys. Used by the Stats dialog (`stats-tab-*`) and Settings (`settings-tab-display`, `settings-tab-play`) |
| `SegmentedControl` (`components/SegmentedControl.tsx`) | One choice out of two or three short options as joined pills; native radios underneath (`role="radiogroup"`). Used for the language, "Playing a card" and scoring settings, the scoring toggle in Stats and the announcements in the declaration picker |
| `Switch` (`components/Switch.tsx`) | On/off toggle with a label; a native checkbox covers the whole row (the test id goes on the input). Used for the lobby rules, "List publicly" and "Ouvert" |
| `TopBar`, `Toasts`, `ConfirmDialog`, `PlayersDialog`, `AboutDialog` | Dialogs close on Esc (`ConfirmDialog` keeps its Cancel / Confirm buttons; `ResultDialog` has only Continue) |
| `VersionBadge` | `v<version>` link bottom left on every screen, opens `#/changelog` in a new tab (§1) |
| `stats/*` | `statistics.md` §3 |

Styling: `styles/tokens.css` (palette, fonts, grain noise, `--card-w` etc.), `styles/global.css`
(old oak background from `public/textures/oak-old.webp` (`docs/assets.md` §5) with a lamp glow, grain and smoke; buttons and text fields; includes a
`prefers-reduced-motion` rule), one `X.module.css` per component. The theme is a westphalian
Schänke (dark oak, worn baize table, brass accents); dark only. Headings use `--font-display`
(Pirata One, bundled as `public/fonts/PirataOne-latin-400.woff2` with its OFL text, `@font-face`
in `global.css`; serif fallbacks), text uses `--font-body`
(system sans). Panels are `--panel` with `--grain`; dialogs are `--panel-solid` with `--grain`; the card table is `--felt` on an oak rim.
Buttons are ≥ 44 px tap targets. Image URLs come from `assets.ts` (`cardUrl`, `backUrl`,
`logoUrl`, based on `import.meta.env.BASE_URL`). Card images are preloaded once per page when a
table opens (`preload.ts`), so tricks and open hands show without delay.

**Theme every new element.** The app is dark only: `:root` sets `color-scheme: dark`, and
`global.css` styles the native controls `button`, `input[type='text']` and `select` (including
`option`, which draws the popup list) with `--ink` on `--panel-solid`. A new control must use
these tokens and never rely on browser defaults (white popups, light scrollbars). When you add a
new kind of native element (`textarea`, `input[type=range]`, `details`, …), add a rule to
`global.css` first, then check it in the browser. Overrides in a module (e.g. `.field select` in
`SettingsDialog.module.css`) must keep `color` and `background` from the tokens.

## 11. Analysis screen (`analysis/`, plan `docs/plans/analysis/`)

Entry point: the "Analyze game" button (`open-analysis`) of the result dialog (`ui-game-screen.md` §7),
which opens the link in a new tab.

The card scores are sampled in a **module Web Worker** so the page never freezes. The worker
(`analysis/analysis.worker.ts`) runs `createRunner` (`analysis/runner.ts`, plain TypeScript and
unit-tested without a worker): on `analyze` it builds the position at the cursor with the engine
(`analysisStart`, `positionAt`), then runs one batch of `SAMPLES_PER_BATCH` (8) worlds per playable
card still in play (`scoreBatch` with `activeCards`: cards clearly behind stop, I189) per step. After
every batch it posts the summed stats (`scores`); the loop stops when one card is clearly the best or
the leading cards reach `MAX_SAMPLES_PER_CARD` (3000), or at once for Ramsch, passed-in games and the end
of the line (`scores` with `[]`, `done`). Steps are scheduled with `setTimeout(f, 0)`, so a stop or
a new request takes effect after at most one batch (~30–60 ms). Every request has an `id`; a step
of an older id posts nothing and a response of an older id is dropped by the hook.

`analysis/useCardScores.ts` owns the worker: one worker per mounted screen (created in an effect,
`terminate()` on unmount). A change of the position key (`plays`, real-hands switch and rollout epsilon) restarts the
sampling from zero; a pause sends `stop` and keeps the shown stats; resuming continues from them
(`initial`), so no sample is counted twice. The messages (`workerProtocol.ts`) never leave the
tab, so they are typed but not zod-validated; the input was validated by the link (decision I185).
The `input` argument must be a stable object (memoize it), otherwise the sampling restarts on
every render.

### The analysis screen (`analysis/AnalysisScreen.tsx`, plan step 07)

`#/analysis?g=…` is a page of its own (new tab, no session store). It shows, top to bottom:
a summary line (`summaryText`: "Anna plays Grand Hand · bid 48", "Ramsch", "Everybody passed"),
`DealOverview` (the starting cards of every player, the Skat, the discarded cards after a pickup,
the declarer marked `*`), and for played and Ramsch games `AnalysisReplay`. A passed-in game
stops after the deal overview: no replay, no worker. The link is decoded once (`decodeAnalysis`);
invalid data shows `analysis.invalid`.

- **Replay board** (`ReplayBoard`, `SeatHand`): one seat per role, all cards face up. The player
  to move is highlighted (`aria-current`), their playable cards are buttons (`analysis-card-<id>`)
  with a win-rate badge; the others are drawn disabled. The current trick sits in the middle.
  Clicking a playable card plays it (`chooseCard`).
- **State** (`AnalysisReplay.tsx`): one `AnalysisLine` (`plays`, `cursor`). Navigation is pure
  (`lineNav.ts`): start, back, forward, end, jump to trick n (cursor = 3n), reset. A card that
  differs from the actual next card starts a variant: the line is cut there (`chooseCard`).
  Forward is off at the end of a line; a variant continues only by choosing a card.
  The keys ArrowLeft / ArrowRight / Home / End move the cursor; they are ignored while focus is in
  a form field. The handler sits on the replay wrapper, so the keys work while focus is on the board.
- **Controls** (`ReplayControls`): the four step buttons, the status line (`analysis-status`,
  "Trick 3 · card 2", or "End of the game"), the variant badge with "Back to the actual game" (only
  while the line differs from the actual game), and for played games: the real-hands switch
  (`analysis-real-hands`), the share of random moves in the play-outs (`analysis-epsilon`, 0/5/10/20/30 %,
  default 10 %, I190; a change restarts the sampling), "Play best" (the best card by the chosen criterion), and pause/resume.
  The switch is off by default; the hint says what it means.
- **Scores** (`ScoreList`): one row per playable card, best first (`rankStats`): card, win rate,
  Ø / median / max / min points (hidden for Null), and the marks "played" (the actual game's next card)
  and "best". A selector (`analysis-criterion`, not for Null) chooses the value that ranks the
  cards and decides "best" and "Play best": win rate (default), average, median, max or min; the
  other values break ties. Before the first batch the rows show zeros and "Calculating…". A row is a button that
  plays the card. Ramsch shows "No scores for Ramsch games." and no sampling. Win-rate colours:
  `--analysis-good` from 60 %, `--analysis-bad` up to 40 % (`winTone`).
- **Result** (`AnalysisResult`): replaces the score list when the line reached the end of the game
  (won/lost with the game, points, tricks, value; for Ramsch the losers or Durchmarsch, Jungfrau and
  per-player points and score change).
- **Tricks** (`TrickHistory`): every completed trick of the whole line, one button per trick
  (`analysis-trick-<n>`, 1-based) that jumps to its end. Tricks from the variant start on carry a
  variant tag on the first one and a left accent on the others.

Layout: mobile first, one column. From 900 px the board is left and the controls, scores or result
are right (`AnalysisReplay.module.css`). Every card button has an `aria-label` with the card name and
its win rate; tap targets are at least 44 px. The worker and its hook are described above.
