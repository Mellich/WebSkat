// `#/dev/local`: creates an offline practice table and opens it (DEV builds only).

import { useEffect } from 'react';
import { navigate, tableHash } from '../router';
import { useSettings } from '../store/settings';
import { startLocalTable } from './localTable';

export function DevLocal() {
  const name = useSettings((s) => s.name).trim();
  useEffect(() => {
    const key = startLocalTable(name === '' ? 'You' : name);
    navigate(tableHash(key));
  }, [name]);
  return <p style={{ padding: 24 }}>Starting offline practice…</p>;
}
