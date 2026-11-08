// Table keys: 8 symbols of a 32-symbol alphabet without 0/O/1/I, i.e. 40 bits (docs/networking.md §7).

export const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KEY_LENGTH = 8;

/** Uppercase, without spaces and dashes. Does not check the length or the alphabet. */
export function normalizeKey(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

/** `ABCD-EFGH` for an 8-character key; other input is returned normalized. */
export function formatKey(key: string): string {
  const k = normalizeKey(key);
  return k.length === KEY_LENGTH ? `${k.slice(0, 4)}-${k.slice(4)}` : k;
}

export function isValidKey(input: string): boolean {
  const k = normalizeKey(input);
  return k.length === KEY_LENGTH && Array.from(k).every((c) => KEY_ALPHABET.includes(c));
}

/**
 * A new key. Each byte is reduced to 5 bits; 256 is a multiple of 32, so every symbol is
 * equally likely.
 */
export function generateKey(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(KEY_LENGTH);
  const key = Array.from(bytes, (b) => KEY_ALPHABET[b & 31] ?? '').join('');
  return formatKey(key);
}

/**
 * Link that opens the table in the app (`base` is e.g. `location.origin + location.pathname`).
 * With an invite code the link takes over a disconnected player's seat.
 */
export function joinLink(key: string, base: string, invite?: string): string {
  const query = invite === undefined ? '' : `?invite=${formatKey(invite)}`;
  return `${base}#/t/${formatKey(key)}${query}`;
}
