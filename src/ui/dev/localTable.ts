// Offline practice (DEV builds only): this browser hosts a table on an in-memory network and
// seats two bots. No WebRTC or relay is involved.

import { createFakeNetwork } from '../../net/fake';
import { createHost, generateKey, normalizeKey, randomBytes, randomUint32 } from '../../net';
import { createTable } from '../../table';
import { useSession } from '../store/session';

export function startLocalTable(hostName: string): string {
  const key = normalizeKey(generateKey(randomBytes));
  const table = createTable({
    key,
    name: `${hostName} (practice)`,
    isPublic: false,
    hostId: 'local-host',
    hostName,
    maxSeats: 3,
  });
  const host = createHost({
    transport: createFakeNetwork().transportFor('local'),
    table,
    now: () => Date.now(),
    randomSeed: randomUint32,
  });
  useSession.getState().attach({ key, connection: host.connection, host });
  host.connection.send({ type: 'add-bot' });
  host.connection.send({ type: 'add-bot' });
  return key;
}
