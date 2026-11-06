// The only networking surface the UI sees (docs/05-networking.md §5).

import type { GameRecord, TableCommand, TableView } from '../table';

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'host-lost'
  | 'rejected'
  | 'kicked'
  | 'closed';

export type ConnectionEvent =
  | { readonly t: 'status'; readonly status: ConnectionStatus; readonly reason?: string }
  | { readonly t: 'view'; readonly view: TableView }
  | { readonly t: 'records'; readonly records: readonly GameRecord[] }
  | { readonly t: 'record'; readonly record: GameRecord }
  | { readonly t: 'error'; readonly code: string; readonly message: string };

export interface GameConnection {
  playerId(): string | null;
  send(command: TableCommand): void;
  /** Replays the latest status and view to a new listener. Returns the unsubscribe function. */
  subscribe(listener: (e: ConnectionEvent) => void): () => void;
  close(): void;
}

/** Listener set with replay of the latest status and view (used by host and client). */
export interface Emitter {
  emit(e: ConnectionEvent): void;
  subscribe(listener: (e: ConnectionEvent) => void): () => void;
  latestStatus(): ConnectionStatus | null;
}

export function createEmitter(): Emitter {
  const listeners = new Set<(e: ConnectionEvent) => void>();
  let status: ConnectionStatus | null = null;
  let view: ConnectionEvent | null = null;
  return {
    emit(e) {
      if (e.t === 'status') status = e.status;
      if (e.t === 'view') view = e;
      for (const listener of [...listeners]) listener(e);
    },
    subscribe(listener) {
      listeners.add(listener);
      if (status !== null) listener({ t: 'status', status });
      if (view !== null) listener(view);
      return () => {
        listeners.delete(listener);
      };
    },
    latestStatus: () => status,
  };
}
