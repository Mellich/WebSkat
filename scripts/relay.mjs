// Self-hosted signaling relay (docs/05-networking.md §8). Forwards WebRTC signaling messages only;
// it contains no game logic and sees no game data. Run with `npm run relay`.

import { createWsRelayServer } from '@trystero-p2p/ws-relay/server';

const port = Number(process.env.PORT ?? 8787);
const relay = createWsRelayServer({ port });

await relay.ready;
console.log(`WebSkat signaling relay listening on ws://localhost:${String(port)}`);

const shutdown = () => {
  relay.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
