// Cryptographically strong randomness for ids, tokens, keys and deal seeds (impure: uses the
// Web Crypto API).

export function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function randomHex(n: number): string {
  return Array.from(randomBytes(n), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A 32-bit unsigned integer, used as the deal seed. */
export function randomUint32(): number {
  const view = new Uint32Array(1);
  globalThis.crypto.getRandomValues(view);
  return view[0] ?? 0;
}
