// Things the screens do with the network: host a table, resume one, join one, leave. Everything
// else goes through the GameConnection that the session store holds.

import {
  createClient,
  createHost,
  generateKey,
  normalizeKey,
  randomBytes,
  randomHex,
  randomUint32,
  type Host,
  type HostSnapshot,
  type Transport,
} from '../../net';
import { createTable, type TableState } from '../../table';
import { loadHostSnapshot, removeHostSnapshot, resumableSnapshot, saveHostSnapshot } from '../persist/hosted';
import { clearSession, loadSession, saveSession } from '../persist/session';
import { browserStorage } from '../persist/storage';
import { useSession } from '../store/session';

import { getTransport } from './transport';

const SAVE_DELAY_MS = 300;

/** Writes the host snapshot shortly after the last change (a burst of commands is one write). */
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();
function saveSoon(snapshot: HostSnapshot): void {
  const storage = browserStorage();
  if (storage === null) return;
  const key = snapshot.table.key;
  clearTimeout(pendingSaves.get(key));
  pendingSaves.set(key, setTimeout(() => {
    pendingSaves.delete(key);
    saveHostSnapshot(storage, snapshot);
  }, SAVE_DELAY_MS));
}

/**
 * Starts that run at most once per table key at a time. React's StrictMode runs effects twice, and
 * a second start would open a second connection to the same room.
 */
const starting = new Map<string, Promise<void>>();
function startOnce(key: string, start: () => Promise<void>): Promise<void> {
  const running = starting.get(key);
  if (running !== undefined) return running;
  const promise = start().finally(() => {
    starting.delete(key);
  });
  starting.set(key, promise);
  return promise;
}

function startHost(transport: Transport, table: TableState, tokens: HostSnapshot['tokens']): Host {
  return createHost({
    transport,
    table,
    tokens,
    now: () => Date.now(),
    randomSeed: randomUint32,

    lobby: transport,
    persist: saveSoon,
  });
}

export interface HostInput {
  readonly hostName: string;
  readonly tableName: string;
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
  });
  const host = startHost(transport, table, {});
  useSession.getState().attach({ key, connection: host.connection, host });
  saveSoon(host.snapshot());
  return key;
}

/** Attaches this browser to a table it hosted before. Humans come back with their tokens. */
async function attachResumedHost(snapshot: HostSnapshot): Promise<void> {
  const key = snapshot.table.key;
  if (useSession.getState().key === key) return;
  const transport = await getTransport();
  const resumed = resumableSnapshot(snapshot);
  const host = startHost(transport, resumed.table, resumed.tokens);
  useSession.getState().attach({ key, connection: host.connection, host });
}

/** Resumes a table this browser hosted before (after a reload). Returns false if there is none. */
export async function resumeHostedTable(key: string): Promise<boolean> {
  const storage = browserStorage();
  const snapshot = storage === null ? null : loadHostSnapshot(storage, key);
  if (snapshot === null) return false;
  await startOnce(key, () => attachResumedHost(snapshot));
  return true;
}

/** Joins a table by key as a client. A stored token reclaims an old seat. */
async function attachClient(key: string, name: string, token: string | undefined): Promise<void> {
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

/**
 * Opens a table for the table route: if this browser hosts it, the host is resumed; otherwise it
 * joins as a client, reclaiming the seat with the stored token when there is one.
 */
export function openTable(key: string, name: string): Promise<void> {
  return startOnce(key, async () => {
    const storage = browserStorage();
    const snapshot = storage === null ? null : loadHostSnapshot(storage, key);
    if (snapshot !== null) {
      await attachResumedHost(snapshot);
      return;
    }
    const stored = storage === null ? null : loadSession(storage);
    await attachClient(key, name, stored?.key === key ? stored.token : undefined);
  });
}

/** Drops the snapshot of a hosted table, including a save that is still waiting. */
function forgetHostSnapshot(key: string): void {
  clearTimeout(pendingSaves.get(key));
  pendingSaves.delete(key);
  const storage = browserStorage();
  if (storage !== null) removeHostSnapshot(storage, key);
}

/** Leaves the current table for good: closes the connection and forgets the seat (or the hosted table). */
export function leaveTable(): void {
  const { key, host, detach } = useSession.getState();
  detach();
  if (key === null) return;
  if (host !== null) forgetHostSnapshot(key);
  const storage = browserStorage();
  if (storage !== null && loadSession(storage)?.key === key) clearSession(storage);
}
