// `#/dev/local[?seed=N&players=3..6&bots=easy|normal|strong]`: creates an offline practice table and opens it
// (DEV builds only).

import { useEffect } from 'react';
import { navigate, tableHash } from '../router';
import { useSettings } from '../store/settings';
import type { BotLevel } from '../../table';
import { startLocalTable } from './localTable';

export function DevLocal({ seed, players, bots }: { readonly seed: number | null; readonly players: number; readonly bots: BotLevel }) {
  const name = useSettings((s) => s.name).trim();
  useEffect(() => {
    const key = startLocalTable(name === '' ? 'You' : name, seed, players, bots);
    navigate(tableHash(key));
    // The session store owns the connection from here on.
  }, [name, seed, players, bots]);
  return <p style={{ padding: 24 }}>Starting offline practice…</p>;
}
