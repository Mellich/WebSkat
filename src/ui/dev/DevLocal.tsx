// `#/dev/local[?seed=N]`: creates an offline practice table and opens it (DEV builds only).

import { useEffect } from 'react';
import { navigate, tableHash } from '../router';
import { useSettings } from '../store/settings';
import { startLocalTable } from './localTable';

export function DevLocal({ seed }: { readonly seed: number | null }) {
  const name = useSettings((s) => s.name).trim();
  useEffect(() => {
    const key = startLocalTable(name === '' ? 'You' : name, seed);
    navigate(tableHash(key));
    // The session store owns the connection from here on.
  }, [name, seed]);
  return <p style={{ padding: 24 }}>Starting offline practice…</p>;
}
