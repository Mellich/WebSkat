# Overview

## 1. What WebSkat is

A browser-only, peer-to-peer multiplayer implementation of the German card game **Skat**.

- Static website. There is no application server and no account system.
- Browsers connect directly over WebRTC (library **Trystero**). Public Nostr relays (default) or a
  small self-hosted relay are used only for *signaling* (finding each other). They never see game
  data.
- 3 players: classic Skat. 4–6 players: **Geberskat**. In each game only three play, the dealer
  and any extra players sit out, and the seats rotate after every game.
- One browser, the **host** (whoever created the table), runs the game logic. The others send
  commands and receive a filtered view of the table (`architecture.md`, `hidden-information.md`).
- Bots (easy / normal / strong) can fill seats. They run inside the host's browser.
- English and German UI.

## 2. Status

All implementation phases 0–14 of the original plan are done (archive: `history/implementation-plan.md`).
`npm run check` and `npm run e2e` are green. Open items:

| Item | State |
|---|---|
| Lifetime personal statistics on Home | Not implemented (optional; `decisions.md` I79) |
| a11y audit (axe) and Lighthouse run | Not run (`decisions.md` I94) |
| Manual visual check of result dialog, ouvert opponent, 4-player bar at all viewports | Not done |
| Full game between two real devices over the internet | Not done (needs real devices) |
| `abort-game` command | Exists in the table layer; no button in the UI |
| `leave` command | Exists in the table layer; the UI does not send it (Leave closes the connection instead, see `ui.md` §4) |
| Seeger score in the result dialog | The dialog shows the standard score only; Seeger is in the Stats dialog |
| `reducedMotion` setting | Stored, but there is no control for it and nothing reads it |

## 3. Features

| # | Feature | Where |
|---|---|---|
| F1 | Create a table (public or private); join by key `ABCD-EFGH`, by link `#/t/KEY`, or from the public list | `ui.md`, `networking.md` |
| F2 | Bidding with the official bid values, **strictly one step at a time** (house rule) | `skat-rules.md` §4 |
| F3 | Suit games, Grand, Null; Hand, Ouvert, Schneider/Schwarz announced | `skat-rules.md` §5 |
| F4 | Pick up the Skat and discard two cards, or play Hand | `skat-rules.md` §5 |
| F5 | Only legal cards can be played | `skat-rules.md` §6 |
| F6 | Scoring: game value, overbidding, Schneider/Schwarz; standard and Seeger–Fabian | `skat-rules.md` §10 |
| F7 | Table statistics: standings, history, chart | `statistics.md` |
| F8 | Geberskat for 4–6 players | `skat-rules.md` §9, `table.md` |
| F9 | Reconnect after reload (clients and host); players can join between games | `networking.md` §8 |
| F10 | Card back choice, EN/DE, trick display time, two-tap play | `ui.md` §6 |
| F11 | Bots with per-bot strength set by the host in the lobby | `bots.md` |
| F12 | Offline practice (DEV builds): `#/dev/local` | `ui.md` §8 |

## 4. Out of scope

- Ramsch, Kontra/Re, Bock rounds and other house rules (only ISkO rules, plus the strict
  bidding house rule).
- Accounts, server-side storage, chat, voice, spectators, host migration, turn timers, sounds.
- Protection against a cheating **host** (the host's browser holds all cards).

## 5. Key technical decisions

| Topic | Decision |
|---|---|
| Language / UI | TypeScript (strict), React 19, Vite 8, plain CSS modules |
| Networking | Trystero WebRTC mesh; signaling over Nostr (default) or self-hosted ws-relay |
| Authority | Host-authoritative: the host runs the engine; clients get per-player redacted views |
| Game logic | Pure, immutable, deterministic TypeScript; randomness and time are parameters |
| Table list | Hosts of public tables advertise in a shared Trystero "lobby" room |
| State (UI) | Zustand stores |
| Validation | zod for every network message and every value read from `localStorage` |
| Persistence | `localStorage` only |

## 6. Glossary (German Skat terms used in code and docs)

| Term | Meaning | Code |
|---|---|---|
| Vorhand / Mittelhand / Hinterhand | 1st / 2nd / 3rd active player after the dealer | `forehand`, `middlehand`, `hindhand` |
| Geber | dealer | `dealerId` |
| Reizen | bidding; *Sagen* = caller bids, *Hören* = listener holds ("Ja") or passes ("Weg") | `bid`, `hold`, `pass` |
| Alleinspieler | declarer, the bidding winner; plays alone against two defenders | `declarer` |
| Skat | the 2 face-down cards | `skat` |
| Drücken | discard 2 cards after picking up the Skat | `discard` |
| Hand | declarer does not pick up the Skat | `hand: true`, `play-hand` |
| Ouvert | declarer plays with open cards | `ouvert: true` |
| Schneider / Schwarz | losing side has ≤ 30 card points / took no trick | `schneider`, `schwarz` |
| Grand | only the four Jacks are trump | `kind: 'grand'` |
| Null | declarer must take no trick | `kind: 'null'` |
| Spitzen (mit/ohne N) | count of consecutive top trumps held / missing | `spitzen` |
| Eingepasst | everybody passed; the game is not played | `passed-in` |
| Geberskat | 4+ players: dealer and extra players sit out | `sittingOut` |
| Augen | card points (120 in the deck) | `cardPoints` |
| Schmieren | giving high cards to a partner who wins the trick | (bots) |
