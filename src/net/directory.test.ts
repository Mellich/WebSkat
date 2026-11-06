import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDirectory, type TableAd } from './directory';
import { AD_TTL_MS, LOBBY_ROOM, PROTOCOL_VERSION } from './constants';
import { createRig, KEY, settle } from './testing';
import { createFakeNetwork } from './fake';

afterEach(() => {
  vi.useRealTimers();
});

describe('table directory', () => {
  it('lists public tables that the host advertises, sorted by name', () => {
    const rig = createRig({ isPublic: true, withLobby: true });
    const seen: TableAd[][] = [];
    const directory = createDirectory(rig.net.transportFor('D'), (tables) => seen.push(tables));
    settle(rig);
    const latest = seen.at(-1) ?? [];
    expect(latest).toMatchObject([{ key: KEY, name: 'Friday game', hostName: 'Host', seats: 1, status: 'lobby' }]);
    directory.stop();
  });

  it('does not list private tables', () => {
    const rig = createRig({ isPublic: false, withLobby: true });
    const seen: TableAd[][] = [];
    createDirectory(rig.net.transportFor('D'), (tables) => seen.push(tables));
    settle(rig);
    expect(seen.at(-1) ?? []).toEqual([]);
  });

  it('forgets advertisements that were not refreshed within the TTL', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const net = createFakeNetwork();
    const seen: TableAd[][] = [];
    const directory = createDirectory(net.transportFor('D'), (tables) => seen.push(tables));
    const advertiser = net.transportFor('X').join(LOBBY_ROOM);
    net.flush();
    advertiser.send('ad', {
      t: 'ad',
      v: PROTOCOL_VERSION,
      key: 'ABCD-EFGH',
      name: 'Old table',
      hostName: 'Anna',
      seats: 2,
      maxSeats: 6,
      status: 'lobby',
      ts: Date.now(),
    }, 'D');
    net.flush();
    expect(seen.at(-1)).toHaveLength(1);

    vi.advanceTimersByTime(AD_TTL_MS + 1000);
    expect(seen.at(-1)).toEqual([]);
    directory.stop();
  });

  it('ignores invalid advertisements', () => {
    const net = createFakeNetwork();
    const seen: TableAd[][] = [];
    createDirectory(net.transportFor('D'), (tables) => seen.push(tables));
    const advertiser = net.transportFor('X').join(LOBBY_ROOM);
    advertiser.send('ad', { t: 'ad', key: 'nope' }, 'D');
    net.flush();
    expect(seen).toEqual([]);
  });

  it('leaves the lobby when stopped', () => {
    const rig = createRig({ isPublic: true, withLobby: true });
    const directory = createDirectory(rig.net.transportFor('D'), () => undefined);
    settle(rig);
    expect(rig.net.members(LOBBY_ROOM)).toContain('D');
    directory.stop();
    expect(rig.net.members(LOBBY_ROOM)).not.toContain('D');
  });
});
