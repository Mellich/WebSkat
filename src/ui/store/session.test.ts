import { describe, expect, it } from 'vitest';
import { createFakeNetwork } from '../../net/fake';
import { createHost } from '../../net/host';
import { createClient } from '../../net/client';
import { createTable } from '../../table';
import { useSession } from './session';

const KEY = 'ABCD-EFGH';

function hostOnNetwork() {
  const net = createFakeNetwork();
  const table = createTable({ key: KEY, name: 'Friday', isPublic: false, hostId: 'host', hostName: 'Host', maxSeats: 3 });
  const host = createHost({ transport: net.transportFor('H'), table, now: () => 0, randomSeed: () => 1 });
  return { net, host };
}

describe('session store', () => {
  it('shows the host view as soon as a connection is attached', () => {
    const { host } = hostOnNetwork();
    useSession.getState().attach({ key: KEY, connection: host.connection, host });
    const state = useSession.getState();
    expect(state.key).toBe(KEY);
    expect(state.status).toBe('connected');
    expect(state.view?.table.name).toBe('Friday');
    state.detach();
  });

  it('turns a host error into a toast', () => {
    const { host } = hostOnNetwork();
    useSession.getState().attach({ key: KEY, connection: host.connection, host });
    expect(useSession.getState().toasts).toEqual([]);
    host.connection.send({ type: 'kick', playerId: 'nobody' });
    const kinds = useSession.getState().toasts.map((t) => t.kind);
    expect(kinds).toEqual(['error']);
    useSession.getState().detach();
  });

  it('closes the connection and forgets the table on detach', () => {
    const { net, host } = hostOnNetwork();
    const client = createClient({ transport: net.transportFor('C'), key: KEY, name: 'Anna', onToken: () => undefined });
    useSession.getState().attach({ key: KEY, connection: client });
    net.flush();
    expect(useSession.getState().status).toBe('connected');
    expect(useSession.getState().view?.table.name).toBe('Friday');
    useSession.getState().detach();
    const state = useSession.getState();
    expect(state.key).toBeNull();
    expect(state.connection).toBeNull();
    expect(state.view).toBeNull();
    host.stop();
  });
});
