// `#/dev/local[?seed=N&players=3..6]`: creates an offline practice table and opens it
// (DEV builds only).

import { useEffect } from 'react';
import { navigate, tableHash } from '../router';
import { useSettings } from '../store/settings';
import { startLocalTable } from './localTable';

export function DevLocal({ seed, players }: { readonly seed: number | null; readonly players: number }) {
  const name = useSettings((s) => s.name).trim();
  useEffect(() => {
    const key = startLocalTable(name === '' ? 'You' : name, seed, players);
    navigate(tableHash(key));
    // The session store owns the connection from here on.
  }, [name, seed, players]);
  return <p style={{ padding: 24 }}>Starting offline practice…</p>;
}
