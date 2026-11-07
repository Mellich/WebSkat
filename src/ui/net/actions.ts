// Things the screens do with the network: host a table, join one, leave. Everything else goes
// through the GameConnection that the session store holds.

import { createClient, createHost, generateKey, normalizeKey, randomBytes, randomHex, randomUint32 } from '../../net';
import { createTable } from '../../table';
import { clearSession, loadSession, saveSession } from '../persist/session';
import { useSession } from '../store/session';
import { getTransport } from './transport';

function browserStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export interface HostInput {
  readonly hostName: string;
  readonly tableName: string;
  readonly maxSeats: number;
  readonly isPublic: boolean;
}

/** Creates a table with this browser as host and attaches to it. Returns the table key. */
export async function hostTable(input: HostInput): Promise<string> {
  const transport = await getTransport();
  const key = normalizeKey(generateKey(randomBytes));
  const table = createTable({
    key,
    name: input.tableName,
    isPublic: input.isPublic,
    hostId: `h${randomHex(8)}`,
    hostName: input.hostName,
    maxSeats: input.maxSeats,
  });
  const host = createHost({
    transport,
    table,
    now: () => Date.now(),
    randomSeed: randomUint32,
    lobby: transport,
  });
  useSession.getState().attach({ key, connection: host.connection, host });
  return key;
}

/** Joins a table by key as a client. A stored token reclaims an old seat. */
export async function joinTable(key: string, name: string, token?: string): Promise<void> {
  const transport = await getTransport();
  const storage = browserStorage();
  const connection = createClient({
    transport,
    key,
    name,
    ...(token === undefined ? {} : { token }),
    onToken: (newToken) => {
      if (storage !== null) saveSession(storage, { key, name, token: newToken });
    },
  });
  useSession.getState().attach({ key, connection });
}

/** Leaves the current table for good: closes the connection and forgets the seat. */
export function leaveTable(): void {
  const { key, detach } = useSession.getState();
  detach();
  const storage = browserStorage();
  if (storage !== null && loadSession(storage)?.key === key) {
    clearSession(storage);
  }
}
