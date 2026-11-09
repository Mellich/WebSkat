// The app version (docs/dev/versioning.md). Vite replaces __APP_VERSION__ with the
// "version" field of package.json at build time (vite.config.ts, `define`).

declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;
