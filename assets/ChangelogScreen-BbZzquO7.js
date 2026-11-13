import{c as e,d as t,l as n}from"./index-0YEo7zsl.js";var r=`# Changelog

All notable changes to WebSkat are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). How to add an entry and pick the
next version: \`docs/dev/versioning.md\`.

Versions before 0.7.0 were reconstructed from the git history.

## [0.15.1] - 2026-11-13

### Fixed

- The felt stamp (club logo) was missing in the released build: its URL was relative and resolved against the CSS file (\`/assets/\`) instead of the page, so it returned 404.

## [0.15.0] - 2026-11-12

### Added

- The club logo is stamped into the felt: darker, slightly worn, as if pressed into leather.

### Changed

- The background is an old, used oak table top with uneven planks, knots, water marks, beer rings, burns and scratches.
- Wide screens without much height (laptops, tablets and phones held sideways) put the opponents beside the felt, so the felt gets more height.
- The Skat and the played cards always lie completely on the felt; they get smaller when the felt is small.
- The bidding, Skat, discard, declare and Kontra/Re panels lie over the felt and the status line, so the felt no longer shrinks when a panel opens. The panel shows what it needs from the covered status line: who won the bidding and the declared game, the Bock line, a reconnect wait and the host's Abort button.
- Long status lines (for example the declared game after taking the Skat on a phone) wrap instead of being cut off.

## [0.14.0] - 2026-11-12

### Changed

- The game type chosen when declaring (suit, Grand, Null) is highlighted in brass, so it is visible before pressing Declare.
- The announcement choice (Normal / Schneider announced / Schwarz announced) when declaring a game is a segmented control like the settings, instead of radio buttons.
- The statistics dialog shows the games played as a fraction of the series limit (e.g. "3 / 12 games"), or the count when the series is unlimited.
- The changelog screen and the statistics dialog are loaded on first use, so the main bundle is smaller and the build no longer warns about a chunk over 500 kB.

### Fixed

- The dropdown for the number of games in the lobby uses the dark theme (its options and popup were white).

## [0.13.0] - 2026-11-12

### Added

- The game result dialog has a "Show all cards" button. After a game it shows every player's dealt cards and the Skat (protocol version 9).
- Number of games: the host sets how many games the table plays in the lobby ("Unlimited" by default). After the last game the result dialog offers the host to play another round (one more game per player).
- Final standings: after the last game, when the host adds no round, a dialog shows a podium of the best three players, table statistics and small fireworks.

### Changed

- Protocol version 10: commands \`set-game-limit\` and \`add-rounds\`, view fields \`gameLimit\`, \`gamesPlayed\` and \`seriesOver\`. Old host snapshots are upgraded on load; clients of the previous version cannot join.
- The changelog screen shows changes that are not released yet under "Unreleased".

## [0.12.0] - 2026-11-11

### Changed

- Strong bots play stronger: each card decision samples many more possible hidden-card deals (up to 150 instead of 40 per card), so they take up to half a second per decision instead of a fraction of one.
- Visual rework of the dialogs. Every dialog (Statistics, Settings, Players, Game log, About) has the same title bar, and its close button is an icon (×) in the top right instead of a text button. Esc still closes.
- The Statistics dialog switches its content with tabs (Standings, History, Charts). The scoring choice is a segmented control.
- Settings has two tabs, "Display" (language, card back, timing) and "Play" (playing a card, scoring). Language, "Playing a card" and scoring are segmented controls.
- The on/off choices (the lobby rules Ramsch, Bockrunden and Kontra and Re, "List publicly" on Home, and "Ouvert" when declaring) are switches instead of checkboxes.

## [0.11.1] - 2026-11-10

### Fixed

- During the Kontra and Re question the status line above the cards names the game again (for example "Grand Hand by Anna (bid 23)"), so it is clear what Kontra would double. It shows "Kontra" or "Re" once said.

## [0.11.0] - 2026-11-10

### Added

- Kontra and Re, an optional table rule (\`skat-rules.md\` §14). The host switches it in the lobby, like Ramsch and Bockrunden, between games. After the declaration the defenders may say Kontra (doubles the game, once), and the declarer may answer Re (doubles again). Either side may decline. Kontra and Re also multiply the scores of Bock games. Bots never say Kontra or Re.

### Changed

- Protocol version 8: the actions \`kontra\`, \`re\` and \`no-double\`, the phase \`doubling\`, the table rule \`kontra\` in the \`set-rules\` command and in views, and the Kontra/Re level in results, records and the game log. Old host snapshots are upgraded on load; clients of the previous version cannot join.

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
  License, bundled in \`public/fonts\`); all other text stays in a plain, readable sans-serif.
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
  changelog in a new tab (\`#/changelog\`).
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
- Cards that cannot be played are disabled buttons with \`aria-disabled\`.
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
`,i=/^## \[([^\]]+)\](?:\s*-\s*(\S+))?\s*$/,a=/^### (.+?)\s*$/,o=/^- (.*)$/,s=/^\s+(\S.*)$/;function c(e){let t=[],n=null,r=null;for(let c of e.split(/\r?\n/)){let e=i.exec(c);if(e!==null){n={version:e[1]??``,date:e[2]??null,sections:[]},t.push(n),r=null;continue}if(c.startsWith(`## `)){n=null,r=null;continue}if(n===null)continue;let l=a.exec(c);if(l!==null){r={title:l[1]??``,items:[]},n.sections.push(r);continue}if(r===null)continue;let u=o.exec(c);if(u!==null){r.items.push(u[1]??``);continue}let d=s.exec(c),f=r.items.length-1;d!==null&&f>=0&&(r.items[f]=`${r.items[f]??``} ${d[1]??``}`)}return t}function l(e){return e.toLowerCase()===`unreleased`}function u(e){return e.split("`").map((e,t)=>({code:t%2==1,text:e})).filter(e=>e.text!==``)}var d={page:`_page_184x6_1`,current:`_current_184x6_13`,release:`_release_184x6_18`,date:`_date_184x6_34`},f=n(),p={Added:`changelog.section.Added`,Changed:`changelog.section.Changed`,Deprecated:`changelog.section.Deprecated`,Removed:`changelog.section.Removed`,Fixed:`changelog.section.Fixed`,Security:`changelog.section.Security`};function m(e,t){let n=p[e];return n===void 0?e:t(n)}function h({text:e}){return(0,f.jsx)(`li`,{children:u(e).map((e,t)=>e.code?(0,f.jsx)(`code`,{children:e.text},t):(0,f.jsx)(`span`,{children:e.text},t))})}function g({release:e,t}){return(0,f.jsxs)(`section`,{className:d.release,"data-testid":`changelog-release`,children:[(0,f.jsxs)(`h2`,{children:[l(e.version)?t(`changelog.unreleased`):t(`changelog.release`,{version:e.version}),e.date===null?null:(0,f.jsx)(`span`,{className:d.date,children:e.date})]}),e.sections.map(e=>(0,f.jsxs)(`div`,{children:[(0,f.jsx)(`h3`,{children:m(e.title,t)}),(0,f.jsx)(`ul`,{children:e.items.map((e,t)=>(0,f.jsx)(h,{text:e},t))})]},e.title))]})}function _({text:n=r}){let i=t(),a=c(n);return(0,f.jsxs)(`main`,{className:d.page,"data-testid":`changelog`,children:[(0,f.jsx)(`h1`,{children:i(`changelog.title`)}),(0,f.jsx)(`p`,{className:d.current,children:i(`changelog.current`,{version:e})}),a.map(e=>(0,f.jsx)(g,{release:e,t:i},e.version))]})}export{_ as ChangelogScreen};