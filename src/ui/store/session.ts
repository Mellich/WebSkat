// The table this browser is connected to, and the events it has received (zustand).

import { create } from 'zustand';
import type { ConnectionEvent, ConnectionStatus, GameConnection, Host } from '../../net';
import type { GameRecord, TableView } from '../../table';
import { en } from '../i18n/en';
import { translateNow } from '../i18n';
import { loadRecordCache, saveRecordCache, RECORD_CACHE_LIMIT } from '../persist/records';
import { browserStorage } from '../persist/storage';

export interface Toast {
  readonly id: number;
  readonly text: string;
  readonly kind: 'error' | 'info';
}

export interface SessionState {
  readonly key: string | null;
  readonly connection: GameConnection | null;
  readonly host: Host | null;
  readonly status: ConnectionStatus | null;
  readonly reason: string | null;
  readonly view: TableView | null;
  readonly records: readonly GameRecord[];
  readonly toasts: readonly Toast[];
  readonly attach: (input: { readonly key: string; readonly connection: GameConnection; readonly host?: Host }) => void;
  /** 'leave' tells the host first (GameConnection.leave); 'close' just disconnects. */
  readonly detach: (mode?: 'close' | 'leave') => void;
  readonly toast: (text: string, kind?: 'error' | 'info') => void;
  readonly dismiss: (id: number) => void;
}

const EMPTY = { key: null, connection: null, host: null, status: null, reason: null, view: null } as const;


/** Text for an error code: the translation if we have one, otherwise the host's message. */
export function errorText(code: string, message: string): string {
  const key = `error.${code}`;
  return key in en ? translateNow(key as keyof typeof en) : message;
}

export const useSession = create<SessionState>()((set, get) => {
  let unsubscribe: (() => void) | null = null;
  let nextToast = 1;

  const addToast = (text: string, kind: 'error' | 'info' = 'info'): void => {
    const id = nextToast++;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
  };

  /** Keeps the statistics available after a reload; the host's list is authoritative. */
  const cache = (key: string | null, records: readonly GameRecord[]): void => {
    const storage = browserStorage();
    if (storage !== null && key !== null) saveRecordCache(storage, key, records.slice(-RECORD_CACHE_LIMIT));
  };

  const handle = (e: ConnectionEvent): void => {
    switch (e.t) {
      case 'status':
        set({ status: e.status, reason: e.reason ?? null });
        return;
      case 'view':
        set({ view: e.view });
        return;
      case 'records':
        set({ records: [...e.records] });
        cache(get().key, e.records);
        return;
      case 'record': {
        const records = [...get().records, e.record];
        set({ records });
        cache(get().key, records);
        return;
      }
      case 'error':
        addToast(errorText(e.code, e.message), 'error');
        return;
      default: {
        const unused: never = e;
        return unused;
      }
    }
  };

  return {
    ...EMPTY,
    records: [],
    toasts: [],
    attach({ key, connection, host }) {
      get().detach();
      const storage = browserStorage();
      const cached = storage === null ? [] : loadRecordCache(storage, key);
      set({ ...EMPTY, key, connection, host: host ?? null, records: cached, toasts: get().toasts });
      unsubscribe = connection.subscribe(handle);
    },
    detach(mode = 'close') {
      unsubscribe?.();
      unsubscribe = null;
      const { connection } = get();
      set({ ...EMPTY, records: [], toasts: get().toasts });
      if (mode === 'leave') connection?.leave();
      else connection?.close();
    },
    toast: addToast,
    dismiss(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
  };
});
