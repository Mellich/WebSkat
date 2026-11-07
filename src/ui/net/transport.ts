// The one transport of the app, created on first use from the build-time configuration.

import { createTrysteroTransport, signalingConfigFrom, type Transport } from '../../net';

let transport: Promise<Transport> | null = null;

export function getTransport(): Promise<Transport> {
  transport ??= createTrysteroTransport(signalingConfigFrom(import.meta.env));
  return transport;
}
