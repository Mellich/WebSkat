# 05 — Networking (`src/net`)

## 1. Overview

```
Browser ──WebRTC data channels (P2P, encrypted)── Browser
   ▲                                                 ▲
   └── signaling only (SDP exchange): Nostr relays ──┘      default (no server of ours)
                    or self-hosted ws-relay                  fallback (~10 lines, no game logic)
```

Library: **Trystero** (`trystero` package = Nostr strategy). One *room* per table, plus one shared
public *lobby room* for the table list. The host is the authority (`02-architecture.md`).

### Constants (`src/net/constants.ts`)

```ts
export const APP_ID = 'webskat-v1-7c2f9a';        // must be unique to this app
export const PROTOCOL_VERSION = 1;
export const LOBBY_ROOM = 'webskat-lobby-v1';
export const tableRoom = (key: string) => `webskat-t-${normalizeKey(key)}`;
export const AD_INTERVAL_MS = 5000;
export const AD_TTL_MS = 15000;
export const JOIN_TIMEOUT_MS = 15000;
```

## 2. Transport abstraction (`transport.ts`)

Everything above `transport.ts` is independent of Trystero, which makes it testable with an
in-memory fake.

```ts
export type Channel = 'cmd' | 'msg' | 'ad';      // action names are short on purpose (≤ 12 bytes)

export interface RoomHandle {
  readonly selfId: string;                       // Trystero peer id of this browser
  peers(): string[];
  send(channel: Channel, data: unknown, target?: string): void;   // no target = broadcast
  onMessage(cb: (channel: Channel, data: unknown, fromPeerId: string) => void): void;
  onPeerJoin(cb: (peerId: string) => void): void;
  onPeerLeave(cb: (peerId: string) => void): void;
  leave(): void;
}

export interface Transport { join(roomId: string): RoomHandle }

export function createTrysteroTransport(config: SignalingConfig): Promise<Transport>;
export function createFakeNetwork(): { transportFor(selfId: string): Transport };  // tests (fake.ts)
```

### Trystero binding

```ts
// sketch — verify names against node_modules/trystero/dist/*.d.mts and @trystero-p2p/*
import { joinRoom, selfId } from 'trystero';                 // Nostr (default)
const room = joinRoom({ appId: APP_ID, rtcConfig, turnConfig }, roomId);
const cmd = room.makeAction<unknown>('cmd');
cmd.onMessage = (data, { peerId }) => handler('cmd', data, peerId);
cmd.send(data, { target: peerId });          // or cmd.send(data) to broadcast
room.onPeerJoin = (id) => …;  room.onPeerLeave = (id) => …;
room.leave();
```

Signaling strategy is chosen at build time by `import.meta.env.VITE_SIGNALING`:

| value | import | needs |
|---|---|---|
| `nostr` (default) | `trystero` | public relays (built-in default list); optional `VITE_RELAY_URLS` (comma separated `wss://…`) |
| `mqtt` | `trystero/mqtt` or `@trystero-p2p/mqtt` | – |
| `torrent` | `trystero/torrent` | – |
| `ws-relay` | `@trystero-p2p/ws-relay` | `VITE_RELAY_URL=wss://host:port` (self-hosted, see §8) |

Use **dynamic `import()`** per strategy so unused strategies are not bundled. Only `trystero` (nostr)
and `@trystero-p2p/ws-relay` are installed (`01-tech-stack.md`); MQTT/torrent are mentioned for
future use — only implement `nostr` and `ws-relay` in v1.

TURN (optional): `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_CREDENTIAL` → `turnConfig:
[{ urls: [VITE_TURN_URL], username, credential }]`. Document the caveat that credentials in a static
bundle are public.

## 3. Protocol (`protocol.ts`, zod)

All messages are JSON objects with a discriminator `t`. **Every incoming message from the wire is
parsed with these schemas before use**; failures are dropped (and `console.warn`ed once per peer).
Infer TS types with `z.infer`. Share `CardIdSchema` (regex `^[CSHD](7|8|9|10|J|Q|K|A)$`),
`DeclarationSchema`, `GameActionSchema`, `TableCommandSchema`, `TableViewSchema`,
`GameRecordSchema`, `GameResultSchema`. Keep the schemas in sync with the TS types in
`src/table/types.ts` by writing them as `z.ZodType<TableView>` etc. so the compiler flags drift.

### Client → host (channel `cmd`)

```ts
{ t: 'join', v: 1, name: string /*1..40 chars*/, token?: string }
{ t: 'cmd',  command: TableCommand }
```

### Host → client (channel `msg`, always sent with `target`)

```ts
{ t: 'welcome', v: 1, playerId: string, token: string }
{ t: 'view', view: TableView }                          // full snapshot, small (< 5 KB)
{ t: 'records', records: GameRecord[] }                 // full history, sent after welcome/rejoin
{ t: 'record', record: GameRecord }                     // appended after every finished game
{ t: 'error', code: string, message: string, ref?: string }
{ t: 'rejected', reason: 'TABLE_FULL' | 'PROTOCOL_MISMATCH' | 'BAD_NAME' }
{ t: 'kicked' }
{ t: 'closed' }                                          // host closed the table
```

### Lobby (channel `ad`, in `LOBBY_ROOM` only)

```ts
{ t: 'ad', v: 1, key: string, name: string, hostName: string,
  seats: number, maxSeats: number, status: 'lobby' | 'in-game', ts: number }
```
Public-table list entries are *advertisements only*; joining always requires connecting to the
table room and sending `join`.

## 4. Identity and security

- Trystero `peerId` is the transport identity. After `join`, host stores
  `peerToPlayer[peerId] = playerId`. For `cmd` messages the host takes the actor **only from the
  map**. Unknown peers may only send `join`.
- `token` (128-bit random hex, created by the host on first join, returned in `welcome`) lets a
  player reclaim their seat after a reload (their new `peerId` differs). Client stores it in
  `localStorage['webskat.session']`. Host keeps `tokens: Record<token, playerId>`.
- Join handling in `HostController.onJoin(peerId, msg)`:
  1. `msg.v !== PROTOCOL_VERSION` → `rejected PROTOCOL_MISMATCH`.
  2. `msg.token` known → rebind: `peerToPlayer[peerId] = id` (drop any older peer for that player),
     `setConnected(id, true)`.
  3. Else new player: `name = uniqueName(...)`; `addPlayer` → on `TABLE_FULL` → `rejected`.
     Create token.
  4. Send `welcome`, then `records`, then broadcast fresh views to **everyone** (connected flags
     changed).
- `onPeerLeave(peerId)`: `setConnected(playerId, false)`, drop the mapping, broadcast views.
- The host's own player is registered locally (no network) with `peerId = room.selfId`.
- Never trust names/ids inside payloads except `name` of `join`. Never echo raw payloads.

## 5. Controllers

### `GameConnection` (`connection.ts`) — the only thing the UI sees

```ts
export type ConnectionStatus =
  'connecting' | 'connected' | 'host-lost' | 'rejected' | 'kicked' | 'closed';

export type ConnectionEvent =
  | { t: 'status'; status: ConnectionStatus; reason?: string }
  | { t: 'view'; view: TableView }
  | { t: 'records'; records: GameRecord[] }
  | { t: 'record'; record: GameRecord }
  | { t: 'error'; code: string; message: string };

export interface GameConnection {
  readonly playerId: () => string | null;
  send(command: TableCommand): void;
  subscribe(listener: (e: ConnectionEvent) => void): () => void;   // replays last status/view
  close(): void;                                                   // leave room
}
```

### `HostController` (`host.ts`)

```ts
export function createHost(opts: {
  transport: Transport; table: TableState; hostName: string; tokens?: Record<string,string>;
  now: () => number; randomSeed: () => number;       // injected (crypto in prod, fixed in tests)
  persist?: (snapshot: HostSnapshot) => void;
  lobby?: Transport;                                 // pass to advertise (public tables)
}): { connection: GameConnection; stop(): void; getState(): TableState };
```
Behavior:
1. `room = transport.join(tableRoom(key))`; register host as a player (already in `table`).
2. Incoming `cmd`: parse → actor from map → `applyCommand` with `{ now(), seed: randomSeed() }`.
   - ok: `state = value.state`; `runBots`; broadcast views; if `record` → broadcast
     `{t:'record'}`; `persist`.
   - error: send `{t:'error'}` to the sender only.
3. `broadcastViews()`: for every connected non-bot player `p`: `viewFor(state, p.id)`; remote →
   `room.send('msg', {t:'view', view}, peerId)`; host → local listeners.
4. Public table: join `LOBBY_ROOM`, broadcast `ad` every `AD_INTERVAL_MS` and `send` an `ad` to each
   peer that joins the lobby. Stop advertising when `players+pending >= maxSeats`.
5. `stop()`: send `{t:'closed'}` to everyone, leave rooms, clear timers.
6. Trystero callbacks may fire at any time: keep the controller a *single-threaded reducer
   loop*, i.e. `state` is only replaced synchronously inside handlers.

### `ClientController` (`client.ts`)

```ts
export function createClient(opts: {
  transport: Transport; key: string; name: string; token?: string;
  onToken: (token: string, playerId: string) => void;      // UI persists session
}): GameConnection;
```
Behavior:
1. Join room; status `connecting`. On every `onPeerJoin` (and once at start for already-present
   peers) send `{t:'join'}` **to that peer** (the host will answer; other clients ignore it).
2. On first valid `welcome` from peer X: `hostPeerId = X`, status `connected`, `onToken`.
   Ignore `msg` from any other peer afterwards.
3. `view` → emit; `records`/`record` → emit; `error` → emit; `rejected` → status `rejected`;
   `kicked` → `kicked`; `closed` → `closed`.
4. `onPeerLeave(hostPeerId)` → status `host-lost`; keep room open. When any peer joins while
   `host-lost`, send `join` again (with token) — the restored host will re-seat us.
5. If no `welcome` after `JOIN_TIMEOUT_MS` → status `rejected` with `reason: 'TIMEOUT'`
   (UI text: "Table not found or host offline").
6. `send(command)` → `room.send('cmd', {t:'cmd', command}, hostPeerId)`; if no host yet → emit
   `error NOT_CONNECTED`.

### Host loop-back connection
`createHost(...).connection` implements `GameConnection` without network: `send(cmd)` calls the
same `handleCommand(hostPlayerId, cmd)` the network path uses.

## 6. Table directory (`directory.ts`)

```ts
export function createDirectory(lobby: Transport, onChange: (tables: TableAd[]) => void): { stop(): void };
```
Joins `LOBBY_ROOM`, collects `ad`s (zod-validated) into `Map<key, {ad, seenAt}>`, prunes entries
older than `AD_TTL_MS` every second, calls `onChange` with the array sorted by name.
It is only active while the Home screen's "Public tables" list is visible (leave the lobby room
otherwise, to save WebRTC connections). Known limit: the lobby is a full mesh; with > ~20
simultaneous browsers on the home screen it degrades. Future fix (not v1): shard into
`webskat-lobby-v1-0..3` by hash of the table key.

## 7. Keys (`keys.ts`)

```ts
export const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 32 symbols, no 0/O/1/I
export function generateKey(randomBytes: (n: number) => Uint8Array): string;  // 8 chars → 'ABCD-EFGH' form
export function normalizeKey(input: string): string;     // uppercase, strip spaces/dashes → 8 chars
export function isValidKey(input: string): boolean;
export function formatKey(k: string): string;            // 'ABCD-EFGH'
export function joinLink(key: string): string;           // `${location.origin}${location.pathname}#/t/${formatKey(key)}`
```
8 symbols × 5 bits = 40 bits. Private tables are reachable only with the key. Public tables use the
same keys (they are just also advertised).

## 8. Self-hosted relay fallback

`scripts/relay.mjs` (run with `npm run relay`, default port 8787):
```js
import { createWsRelayServer } from '@trystero-p2p/ws-relay/server';
createWsRelayServer({ port: Number(process.env.PORT ?? 8787) });
```
Client build: `VITE_SIGNALING=ws-relay VITE_RELAY_URL=wss://relay.example.com`.
The relay only forwards signaling messages (SDP/ICE); it contains **no game logic** and sees no
game data. It is also used by the Playwright tests so they never depend on public relays.

## 9. Host persistence and resume (Phase 9)

`HostSnapshot = { table: TableState, tokens: Record<string, string> }` is JSON-serializable. After
each accepted command (debounced 300 ms) write it to `localStorage['webskat.host.<key>']`.
On Home, if a snapshot exists → card "Resume table ABCD-EFGH". Resume = `createHost` with the
snapshot, all human players `connected: false`; clients (auto-retrying, see client step 4) rejoin
with their token. This also covers "host reloads the page".

## 10. Failure matrix

| Situation | Behavior |
|---|---|
| Client reloads page | session in localStorage → auto `createClient` with token → seat reclaimed |
| Client disconnects mid-game | `connected=false`; others see "waiting for X" if it is X's turn; no timers |
| Host leaves/crashes | clients: `host-lost` banner; if host resumes (same key) everything continues; else players press "Leave" |
| Wrong key / host offline | `rejected TIMEOUT` after 15 s |
| Table full | `rejected TABLE_FULL` |
| Invalid/malicious message | dropped by zod; never reaches the engine |
| Two tabs with same session | newest `join` with the token wins (older peer is unmapped) |
