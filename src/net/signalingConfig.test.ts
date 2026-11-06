import { describe, expect, it } from 'vitest';
import { signalingConfigFrom } from './signalingConfig';

describe('signalingConfigFrom', () => {
  it('defaults to the Nostr strategy with the library relays', () => {
    expect(signalingConfigFrom({})).toEqual({ strategy: 'nostr', relayUrls: [], relayUrl: null, turn: null });
  });

  it('falls back to nostr for an unknown strategy', () => {
    expect(signalingConfigFrom({ VITE_SIGNALING: 'mqtt' }).strategy).toBe('nostr');
  });

  it('needs a relay URL for ws-relay', () => {
    expect(() => signalingConfigFrom({ VITE_SIGNALING: 'ws-relay' })).toThrow(/VITE_RELAY_URL/);
  });

  it('reads the ws-relay URL', () => {
    const config = signalingConfigFrom({ VITE_SIGNALING: 'ws-relay', VITE_RELAY_URL: ' ws://localhost:8787 ' });
    expect(config).toMatchObject({ strategy: 'ws-relay', relayUrl: 'ws://localhost:8787' });
  });

  it('splits a comma separated list of Nostr relays and drops empty entries', () => {
    const config = signalingConfigFrom({ VITE_RELAY_URLS: 'wss://a.example, wss://b.example,,' });
    expect(config.relayUrls).toEqual(['wss://a.example', 'wss://b.example']);
  });

  it('reads a TURN server with optional credentials', () => {
    expect(signalingConfigFrom({ VITE_TURN_URL: 'turn:t.example:3478' }).turn).toEqual({ url: 'turn:t.example:3478' });
    expect(
      signalingConfigFrom({ VITE_TURN_URL: 'turn:t.example', VITE_TURN_USER: 'u', VITE_TURN_CREDENTIAL: 'c' }).turn,
    ).toEqual({ url: 'turn:t.example', username: 'u', credential: 'c' });
  });
});
