# Changelog

All notable changes to WebSkat are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). How to add an entry and pick the
next version: `docs/dev/versioning.md`.

Versions before 0.7.0 were reconstructed from the git history.

## [0.11.0] - 2026-11-10

### Added

- Kontra and Re, an optional table rule (`skat-rules.md` §14). The host switches it in the lobby, like Ramsch and Bockrunden, between games. After the declaration the defenders may say Kontra (doubles the game, once), and the declarer may answer Re (doubles again). Either side may decline. Kontra and Re also multiply the scores of Bock games. Bots never say Kontra or Re.

### Changed

- Protocol version 8: the actions `kontra`, `re` and `no-double`, the phase `doubling`, the table rule `kontra` in the `set-rules` command and in views, and the Kontra/Re level in results, records and the game log. Old host snapshots are upgraded on load; clients of the previous version cannot join.

## [0.10.1] - 2026-11-10

### Fixed

- A shadow no longer shows under the table's trick while a finished trick is held on screen.
- The dialogs (about, settings, players, game log, stats, confirm and the game result) use the wood panel look again instead of the old dark green.

## [0.10.0] - 2026-11-10

### Added

- The player menu shows the table's invite code and join link to every player, with copy buttons, so anyone can invite friends.

### Changed

- New look: the app now feels like a westphalian Schänke. Dark oak planks with grain, smoke at the
  edges and beer rings on the boards; the card table is worn green baize on an oak rim; panels,
  buttons and the top bar look like old wood and brass. The logo stays prominent on the start page
  under a pub lamp glow.
- Headings use Pirata One, a blackletter-style font close to the logo's lettering (SIL Open Font
  License, bundled in `public/fonts`); all other text stays in a plain, readable sans-serif.
- The start page uses the width of wide screens: create and join sit side by side from 900 px on.

## [0.9.0] - 2026-11-09

### Changed

- Bots get names instead of numbers: the first bot is always Guguurz, the next ones take the next free name from a list of cute names (Blubb, Kartoffel, …).

## [0.8.0] - 2026-11-09

### Added

- The statistics dialog has a "Download CSV" button: one row per game, oldest first, with the
  scores of both scoring systems. The file starts with a byte order mark, so Excel shows umlauts
  correctly.

## [0.7.0] - 2026-11-09

### Added

- The app version is shown in the bottom left corner of every screen. Clicking it opens this
  changelog in a new tab (`#/changelog`).
- This changelog and a versioning process: every change updates the changelog and bumps the
  version.

## [0.6.0] - 2026-11-09

### Added

- Game log dialog from the top bar: joins, disconnects, bids, declared games, Ramsch and Bock
  events and results, the same for everybody (protocol version 7).

## [0.5.0] - 2026-11-09

### Added

- Table rule "Bockrunden": a 60 : 60 game makes the next three games Bock games with doubled
  points (protocol version 6).

## [0.4.0] - 2026-11-09

### Added

- Table rule "Ramsch when everybody passes": everybody plays alone and the fewest card points win
  (protocol version 5).

## [0.3.0] - 2026-11-08

### Added

- The host can replace a seat during a game with a waiting player or a bot, from a new Players
  dialog, and can invite a disconnected player again with an invite code or link (protocol
  version 4).
- Connection dots next to the players.
- Bidding speech bubbles that show each player's last bid, a setting for the bubble duration and
  a summary line for the declarer.
- Trick cards at fixed positions (left, right, own card bottom center).
- The host can abort a running game.
- Card images are preloaded.

### Changed

- The default scoring system is now standard scoring.

### Fixed

- The result dialog follows the Seeger/standard scoring setting.
- "Leave" now tells the host; players who left are removed at the next deal.
- Cards that cannot be played are disabled buttons with `aria-disabled`.
- Text centering in buttons and labels.

### Removed

- The unused "reduced motion" setting and unused texts.

## [0.2.0] - 2026-11-07

### Added

- Bots with three strengths (easy, normal, strong); the host sets the strength per bot in the
  lobby.
- Logo and a script to publish the build to GitHub Pages.

### Changed

- Playtest fixes: bids go up one step at a time, a finished trick stays visible for the configured
  time, the game screen fits phones and desktops without scrolling, small card symbols instead of
  written-out card names.

### Fixed

- Opaque card images.

## [0.1.0] - 2026-11-07

### Added

- First complete version: Skat engine (bidding, Hand, Ouvert, Null, Grand, scoring), table layer
  with seats and dealer rotation, Geberskat for 4–6 players, peer-to-peer networking over WebRTC,
  React UI in English and German, table statistics, settings, reconnect and resume after a
  reload, end-to-end tests and deployment docs.
