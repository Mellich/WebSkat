// The browser's localStorage, or null where it is missing or blocked (private modes, tests).
// The only place in the UI that names localStorage; the stores and screens use this helper.

export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
