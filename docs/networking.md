# Networking (`src/net`)

File map and folder rules: `src/net/AGENTS.md`. The net layer moves messages, tracks peers and
runs timers. **All game decisions are made by `src/table`.**

## 1. Overview and constants

```
Browser ──WebRTC data channels (P2P, encrypted)── Browser
   ▲                                                 ▲
   └── signaling only: Nostr relays (default) or self-hosted ws-relay
```

One Trystero room per table (`tableRoom(key)` = `webskat-t-<KEY>`), plus one shared lobby room
(`webskat-lobby-v1`) for the public table list.

`constants.ts`: `APP_ID = 'webskat-v1-7c2f9a'`, `PROTOCOL_VERSION = 3`, `LOBBY_ROOM`,
`AD_INTERVAL_MS = 5000`, `AD_TTL_MS = 15000`, `JOIN_TIMEOUT_MS = 15000`, `LEAVE_CLOSE_DELAY_MS = 500`.

**Bump `PROTOCOL_VERSION`** whenever a message, command or view changes shape so that old
browsers cannot talk to new ones. Version history: 1 initial, 2 table bot level (Phase 13),
3 per-bot `botLevel` + `set-bot-level` (Phase 14).

## 2. Transport (`transport.ts`, `trysteroTransport.ts`, `fake.ts`)

```ts
type Channel = 'cmd' | 'msg' | 'ad';            // short Trystero action names (≤ 12 bytes)
interface RoomHandle {
  selfId; peers(): string[];
  send(channel, data, target?: string): void;   // no target = everyone in the room
  onMessage(cb(channel, data, fromPeerId)); onPeerJoin(cb); onPeerLeave(cb); leave();
}
interface Transport { join(roomId: string): RoomHandle }
```

- Everything above `transport.ts` uses only these interfaces, so it runs on the in-memory fake.
- `createTrysteroTransport(config)` (only file that imports Trystero) loads the strategy with a
  dynamic `import()`: `trystero` (Nostr) or `@trystero-p2p/ws-relay`. Nostr relay URLs are passed
  only when set; TURN as `turnConfig`.
- Trystero returns the same room object for repeated joins and ends it for all on `leave()`. The
  binding therefore shares one room per id between handles and leaves it when the last handle
  leaves (`decisions.md` I87). Without this, the Home page's lobby directory and an advertising
  host in the same tab break each other.
- `signalingConfigFrom(env)` (`signalingConfig.ts`, pure): `VITE_SIGNALING` (`nostr` default,
  `ws-relay`), `VITE_RELAY_URLS`, `VITE_RELAY_URL` (required for ws-relay; missing → throws),
  `VITE_TURN_URL/USER/CREDENTIAL`.
- `createFakeNetwork()` (`fake.ts`, tests and `#/dev/local`): `transportFor(selfId)`, `flush()`
  delivers queued events in order (including events queued during delivery), `members(roomId)`,
  `drop(peerId)` simulates a crashed tab.

## 3. Protocol (`protocol.ts`, `schemaGame.ts`, `schemaView.ts`)

Every message is a JSON object with discriminator `t`. **Every incoming message is parsed with a
zod schema before use**; invalid messages are dropped (the host warns once per peer). Schemas are
typed `z.ZodType<T>` against the table/engine types, so drift is a compile error.

| Schema file | Contains |
|---|---|
| `schemaGame.ts` | `CardIdSchema`, `DeclarationSchema`, `GameActionSchema` (bid value must be in `BID_VALUES`), `TableCommandSchema` |
| `schemaView.ts` | `TableViewSchema`, `GameRecordSchema` (+ nested view/result schemas) |
| `protocol.ts` | message envelopes below, `AdSchema` |

Client → host (channel `cmd`):
```
{ t:'join', v:number, name: 1..40 chars, token?: 32 hex }
{ t:'cmd', command: TableCommand }
```

Host → client (channel `msg`):
```
{ t:'welcome', v:3, playerId, token }       targeted
{ t:'view', view: TableView }                targeted, per player
{ t:'records', records: GameRecord[] }       targeted, after every welcome
{ t:'record', record: GameRecord }           broadcast after each finished game
{ t:'error', code, message, ref? }           targeted to the sender
{ t:'rejected', reason: 'TABLE_FULL' | 'PROTOCOL_MISMATCH' | 'BAD_NAME' }
{ t:'kicked' }                               targeted
{ t:'closed' }                               broadcast when the host stops
```

Lobby (channel `ad`, only in the lobby room):
```
{ t:'ad', v:3, key, name, hostName, seats, maxSeats, status:'lobby'|'in-game', ts }
```

## 4. Identity and joining (`host.ts` `onJoin`)

1. `v !== PROTOCOL_VERSION` → `rejected PROTOCOL_MISMATCH`.
2. Known `token` of a player still at the table → re-bind this peer to that player (an older peer
   of the same player is unmapped: the newest tab wins), `setConnected(true)`.
3. Otherwise, if this peer has no player yet: new id (`randomHex(8)`), name trimmed and cut to 20
   chars, `addPlayer` (`TABLE_FULL` → `rejected TABLE_FULL`, invalid name → `rejected BAD_NAME`),
   new token (`randomHex(16)`).
4. Send `welcome`, then `records`; broadcast views to everyone; persist.

`onPeerLeave(peer)`: `setConnected(false)`, unmap, broadcast views, persist. The host's own player
has no peer; it uses the loop-back connection.

## 5. Host controller (`createHost`, `host.ts`)

```ts
createHost({ transport, table, tokens?, now, randomSeed, randomId?, randomToken?, persist?, lobby? })
  → { connection: GameConnection, stop(), getState(), snapshot(): HostSnapshot }
HostSnapshot = { table: TableState, tokens: Record<token, PlayerId> }
```

- Joins `tableRoom(key)`. Emits status `connected`, the records and its own view at once.
- `handleCommand(actor, command)` (also used by the loop-back `connection.send`):
  `applyCommand` with `{ now(), seed: randomSeed() }`. Error → `error` to the actor only. Success →
  replace state; a kicked player gets `kicked`; new records go out; views go to every connected
  non-bot player with a peer (plus local listeners); `persist(snapshot)`; then **bot turns run
  synchronously** (`botStep` until `null`), each followed by records + views + persist. No pauses:
  clients slow down the display themselves (`ui-game-screen.md` §5).
- Records: remote peers get one `record` per finished game; the host's own listeners get the whole
  list as a `records` event.
- Public tables (`isPublic` and `lobby` given): join the lobby room, send an `ad` every 5 s and
  to each peer joining the lobby; no ads while `players + pending >= maxSeats`.
- `stop()`: broadcast `closed`, clear the ad timer, leave rooms, emit status `closed`.
- State is replaced only synchronously inside handlers (single-threaded reducer loop).

## 6. Client controller (`createClient`, `client.ts`) and `GameConnection`

```ts
createClient({ transport, key, name, token?, onToken(token, playerId) }) → GameConnection
interface GameConnection { playerId(); send(command); subscribe(listener) /* replays */; leave(); close() }
type ConnectionStatus = 'connecting' | 'connected' | 'host-lost' | 'rejected' | 'kicked' | 'closed'
type ConnectionEvent = status{status, reason?} | view | records | record | error{code, message}
```

- Joins the table room, status `connecting`, sends `join` to every present and newly joining peer
  (only the host answers).
- First valid `welcome` fixes `hostPeer`; status `connected`; `onToken` (the UI stores the
  session). Later `msg`s from other peers are ignored. A `rejected` before welcome → status
  `rejected` with the reason.
- No welcome within 15 s → status `rejected`, reason `TIMEOUT` ("Table not found or host offline").
- Host peer leaves → `host-lost`; the client keeps the room open and re-sends `join` (with token)
  when any peer joins, so a resumed host re-seats it.
- `kicked` / `closed` → that status; the client never re-joins afterwards (`decisions.md` I82).
- `send` without a host → `error NOT_CONNECTED` event.
- `createEmitter()` (`connection.ts`) replays the latest status, records and view to each new
  subscriber.

## 7. Directory and keys

- `createDirectory(lobby, onChange, now?)` (`directory.ts`): joins the lobby room, validates ads,
  keeps them by key, prunes entries older than 15 s every second, calls `onChange` with the list
  sorted by name. Home creates it while mounted and stops it on unmount.
- `keys.ts`: `KEY_ALPHABET` (32 symbols, no 0/O/1/I), `generateKey(randomBytes)` → `ABCD-EFGH`,
  `normalizeKey` (uppercase, no spaces/dashes), `isValidKey`, `formatKey`, `joinLink(key, base)`
  → `${base}#/t/ABCD-EFGH`. Inside the app keys are always stored **normalized** (no dash).
- `random.ts`: `randomBytes`, `randomHex`, `randomUint32` (Web Crypto).

## 8. Persistence and resume (wired in `src/ui/net/actions.ts`)

- The host persists `HostSnapshot` to `localStorage['webskat.host.<KEY>']`, debounced 300 ms.
- Opening `#/t/KEY` in a browser that has a snapshot for KEY resumes the host
  (`resumableSnapshot`: every human except the host starts `connected: false`; bots unchanged).
  Clients in `host-lost` re-join with their tokens.
- Clients store `{key, name, token}` in `localStorage['webskat.session']` and re-join with it.

## 9. Failure matrix

| Situation | Behavior |
|---|---|
| Client reloads | Stored session → `openTable` re-joins with the token → same seat |
| Client disconnects mid-game | `connected = false`; others see "waiting for X" when it is X's turn; no timers |
| Client leaves (`leave()`) | Client sends `leave` (if the host is reachable), `ended = true`, closes the room after 500 ms. Host: lobby → seat removed; game running → `leaving`, removed at the next deal |
| Host leaves (`leave()`) | Same as `stop()`: `closed` to every client |
| Host reloads / crashes | Clients show `host-lost`; when the host reopens the table it resumes from the snapshot and clients re-join |
| Wrong key / host offline | `rejected TIMEOUT` after 15 s |
| Table full | `rejected TABLE_FULL` |
| Invalid / malicious message | Dropped by zod; never reaches the table |
| Two tabs with the same session | Newest `join` wins; the older peer is unmapped |

## 10. Self-hosted relay

`scripts/relay.mjs` (`npm run relay`, port 8787 or `PORT`) starts `createWsRelayServer` from
`@trystero-p2p/ws-relay/server`. It forwards signaling only, has no game logic, and is used by the
e2e tests. Deployment: `deployment.md` §3.
