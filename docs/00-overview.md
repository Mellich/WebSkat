# 00 — Overview

## Goal

**WebSkat** is a browser-only multiplayer implementation of the German card game **Skat**.

- Runs entirely in the browser. Deployed as static files (no application server).
- Players connect **peer-to-peer** (WebRTC). A public signaling network (Nostr relays by default) is
  used *only* to let browsers find each other; it never sees game data and has no game logic.
- 3 players: classic Skat. 4–6 players: **Geberskat** — each game only three play, the others sit
  out, and the seat rotation moves on after every game.
- Minimal graphics: your own 10 cards face up, the backs of the opponents' cards, the cards of the
  current trick on the table, plus statistics of the games played at this table.

## Feature list (scope)

| # | Feature | Doc |
|---|---|---|
| F1 | Create a table (public or private). Others join via a **key** (code / link) or pick a public table from a **list** | 05, 06 |
| F2 | Bidding (Reizen) with the official bid values 18, 20, 22, 23, 24 … | 03, 04 |
| F3 | Game types: Clubs, Spades, Hearts, Diamonds (Farbspiele), Grand, Null; with Hand, Ouvert, Schneider/Schwarz announced | 03 |
| F4 | Skat pick-up and discard (Drücken), or "Hand" | 03, 04 |
| F5 | Card play where **only legal cards can be played** (follow suit / trump) | 03, 04 |
| F6 | Scoring: game value, overbidding (Überreizen), Schneider/Schwarz, win/loss | 03 |
| F7 | Table statistics: points per player, game type and result per game, leaderboards, charts | 07 |
| F8 | Geberskat for 4–6 players (dealer and extra players sit out, rotating) | 03 §9, 04 |
| F9 | Reconnect after page reload; players can join between games | 05 |
| F10 | Card back selection (4 backs), English + German UI | 06, 10 |

## Explicitly out of scope (v1)

- Ramsch, Kontra/Re, Bock rounds, Revolution, Schenken, Spitze/Patrouille and other house rules.
  (Only official ISkO rules; see `03-skat-rules.md`.)
- AI opponents that play well. (Only a trivial *random bot* for tests/demo; see `08` Phase 3.)
- Accounts, server-side persistence, chat, voice/video, spectators, host migration.
- Anti-cheat against a malicious **host** (the host's browser holds all hands; see trust model in
  `02-architecture.md`).

## Decisions at a glance

| Topic | Decision | Why |
|---|---|---|
| Language | TypeScript (strict), React 19, Vite 8 | mainstream, small-model friendly |
| Networking | **Trystero** (WebRTC mesh, serverless signaling over Nostr) | no server needed, simple `makeAction` API, switchable signaling strategy |
| Fallback | Self-hosted **ws-relay** signaling (`@trystero-p2p/ws-relay`), ~10 lines, zero game logic | if public relays are unreliable; same API |
| Authority | **Host-authoritative**: one browser (table creator) runs the engine; clients send commands, receive redacted views | prevents cheating by clients, hides other players' cards, avoids consensus protocols |
| Engine | Pure, immutable, deterministic TypeScript; randomness + time injected | testable, replayable |
| Table list | A well-known public Trystero room ("lobby") in which hosts of public tables advertise themselves | works without any server |
| State mgmt (UI) | Zustand | tiny |
| Validation | zod for all network messages | untrusted input |
| Persistence | `localStorage` only (name, settings, session for reconnect, table history) | no backend |
| Styling | Plain CSS (CSS modules + CSS variables) | no framework to learn |
| Cards | Cropped from the provided sprite sheets into `public/` as WebP by `npm run assets` | see `10-assets.md` |

## Document map

```
docs/
  00-overview.md            this file
  01-tech-stack.md          libraries, versions, config files, scripts
  02-architecture.md        layers, folder layout, data flow, trust model, hidden information
  03-skat-rules.md          RULES + SCORING (single source of truth) with worked examples
  04-game-engine.md         types, state machine, function signatures, algorithms (src/engine)
  05-networking.md          Trystero setup, lobby/table directory, protocol messages, reconnect
  06-ui-ux.md               screens, components, layout, interactions, i18n
  07-statistics.md          game records, aggregations, charts
  08-implementation-plan.md ordered phases with checkboxes and acceptance criteria
  09-testing.md             unit / property / integration / e2e test plan, test vectors
  10-assets.md              sprite geometry, asset script, naming
  11-deployment.md          build, static hosting, TURN, relay fallback
  12-open-questions.md      decisions taken where the spec was ambiguous (append here!)
  13-playtest-fixes.md      Phase 12 spec: strict bidding, trick display time, mobile layout
  14-bots.md                Phase 13/14 spec: bot strength per bot (easy/normal/strong), bidding + card play
```
