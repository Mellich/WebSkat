// Offline practice (DEV builds only): this browser hosts a table on an in-memory network and
// seats bots. No WebRTC or relay is involved. With a seed, every random value (deals and bot
// choices) is fixed, so a deal can be reproduced.

import { createFakeNetwork } from '../../net/fake';
import { createHost, generateKey, normalizeKey, randomBytes, randomUint32 } from '../../net';
import { createTable } from '../../table';
import { useSession } from '../store/session';

export function startLocalTable(hostName: string, seed: number | null, players: number): string {
  const key = normalizeKey(generateKey(randomBytes));
  const table = createTable({
    key,
    name: `${hostName} (practice)`,
    isPublic: false,
    hostId: 'local-host',
    hostName,
    maxSeats: players,
  });
  const host = createHost({
    transport: createFakeNetwork().transportFor('local'),
    table,
    now: () => Date.now(),
    randomSeed: seed === null ? randomUint32 : () => seed,
  });
  useSession.getState().attach({ key, connection: host.connection, host });
  for (let i = 1; i < players; i++) {
    host.connection.send({ type: 'add-bot' });
  }
  return key;
}
