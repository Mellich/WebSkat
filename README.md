# WebSkat

Skat in the browser, peer to peer. Three players, or four to six with Geberskat (the dealer and any
extra players sit out, and the seat rotates after each game). No accounts, no server of our own:
the browsers talk to each other over WebRTC, and only the signaling step uses a relay.

The plan and the rules live in `docs/`. Start with `docs/00-overview.md`; `AGENTS.md` lists the
reading order and the hard rules.

## How to play

1. Open the page and enter your name.
2. **Create table** (give it a name, optionally list it publicly). You are the host. A table has
   up to 6 seats.
3. Share the key (`ABCD-EFGH`), the copied link, or the public list with the others. They enter
   the key on the start page, or open the link.
4. When at least three players or bots are seated, the host presses **Start game**. Bots can fill
   seats with **Add bot**; the host sets each bot's strength (Easy, Normal or Strong) in the lobby.
5. After each game, every player presses **Continue**; the next game is dealt when all connected
   players are ready.

Statistics (standings, history, charts, Seeger or standard scoring) are in the **Stats** dialog.

## Run it

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev          # http://localhost:5173, signaling through the public Nostr relays
npm run build        # production build into dist/
npm run preview      # serve dist/ locally
```

Offline practice against two bots (development builds only): `#/dev/local`
(`?bots=easy|normal|strong`, `?players=3..6`, `?seed=N`).

## Checks

```sh
npm run check        # typecheck + lint + unit and component tests
npm run e2e          # Playwright: several browsers play through the UI
```

`npm run e2e` starts its own signaling relay (`npm run relay`, port 8787) and a dev server with
`VITE_SIGNALING=ws-relay`, so the public relays are not used. The first time, install the browser
with `npx playwright install chromium`. To use an installed Chromium instead, set
`WEBSKAT_CHROMIUM=/path/to/chromium`.

## Deployment

WebSkat is a static site. Build it with `npm run build` and serve `dist/` over HTTPS (WebRTC
requires a secure context). The hash router needs no server rewrites, and `base: './'` works at a
domain root and under a sub-path.

- **GitHub Pages**: Set the Pages source to **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`. Run `npm run publish:pages` to check and build the app and prepare a deployment commit from `dist/`; then push it with `git push origin gh-pages`. The script creates `gh-pages` if needed and does not change the current branch. The Pages build workflow validates `main` but does not deploy.
- **Cloudflare Pages, Netlify, Vercel**: build command `npm run build`, output directory `dist`,
  Node 22.
- **Any static server**: copy `dist/`.

The build generates the card images in `public/` from the originals in `assets/` (`npm run assets`).
Do not change or delete the originals.

## Signaling, relay and TURN

Tables are found and connected through a signaling step (exchanging WebRTC offers and answers).
Two options:

| Variable | Meaning |
|---|---|
| `VITE_SIGNALING` | `nostr` (default, public Nostr relays) or `ws-relay` (your own relay) |
| `VITE_RELAY_URLS` | optional comma-separated Nostr relays replacing the library defaults |
| `VITE_RELAY_URL` | required for `ws-relay`, e.g. `wss://relay.example.com` |
| `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_CREDENTIAL` | optional TURN server for players behind strict NAT |

Copy `.env.example` to `.env.local` to set them, at build time. Every `VITE_*` value ends up in the
public JavaScript bundle, so use only low-value or short-lived TURN credentials.

**Own relay.** `npm run relay` starts the small signaling server in `scripts/relay.mjs` on port
8787 (`PORT` changes it). Deploy it to any Node host behind TLS (`wss://`), then build the client
with `VITE_SIGNALING=ws-relay VITE_RELAY_URL=wss://your-relay`. The relay forwards signaling
messages only.

**TURN.** Most networks connect directly. Symmetric NATs and some corporate or mobile carrier
networks need a TURN relay. A symptom is that two particular players cannot connect while others
can. Any TURN server works (a hosted service or coturn); game data stays end-to-end encrypted.

## Trust model and privacy

- The **host's browser** shuffles the cards and sees every hand, like a friend dealing at a real
  table. Only sit down at tables whose host you trust.
- Players are connected directly (WebRTC, encrypted). Clients only receive their own view of the
  table; other players' hands never leave the host's browser.
- There are no accounts, analytics or cookies. The browser keeps in its local storage: your name,
  settings, your seat at a table (a reconnect token), cached game records, and, for a table you
  host, the table state including the cards (so that a reload can resume it). Leaving a table
  forgets it; clearing the site data removes everything.
- Signaling relays learn that some browser joined a table and the network addresses of the
  connection (and so do the STUN servers). They never see game messages.

## Project layout

- `src/engine` (rules, pure), `src/table` (table, scoring, statistics, views, bots; pure),
  `src/net` (protocol, host and client controllers, transports), `src/ui` (React screens).
- `docs/` holds the specification and the decision log (`docs/12-open-questions.md`).
- `e2e/` holds the Playwright tests.
