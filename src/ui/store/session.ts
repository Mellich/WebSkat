// The table this browser is connected to, and the events it has received (zustand).

import { create } from 'zustand';
import type { ConnectionEvent, ConnectionStatus, GameConnection, Host } from '../../net';
import type { GameRecord, TableView } from '../../table';
import { en } from '../i18n/en';
import { translateNow } from '../i18n';

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
  readonly detach: () => void;
  readonly toast: (text: string, kind?: 'error' | 'info') => void;
  readonly dismiss: (id: number) => void;
}

const EMPTY = { key: null, connection: null, host: null, status: null, reason: null, view: null, records: [] } as const;

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
        return;
      case 'record':
        set((s) => ({ records: [...s.records, e.record] }));
        return;
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
    toasts: [],
    attach({ key, connection, host }) {
      get().detach();
      set({ ...EMPTY, key, connection, host: host ?? null, toasts: get().toasts });
      unsubscribe = connection.subscribe(handle);
    },
    detach() {
      unsubscribe?.();
      unsubscribe = null;
      const { connection } = get();
      set({ ...EMPTY, toasts: get().toasts });
      connection?.close();
    },
    toast: addToast,
    dismiss(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
  };
});
