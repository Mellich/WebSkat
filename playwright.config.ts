// End-to-end tests (docs/09-testing.md §5). Every browser context is one player with its own
// storage. The signaling relay and the dev server are started here, so no public Nostr relay is used.
// Set WEBSKAT_CHROMIUM to a Chromium binary to use an installed browser instead of Playwright's.

import { defineConfig } from '@playwright/test';

const APP_PORT = 5173;
const RELAY_PORT = 8787;
const APP_URL = `http://localhost:${String(APP_PORT)}/`;
const RELAY_URL = `ws://localhost:${String(RELAY_PORT)}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
      ...(process.env.WEBSKAT_CHROMIUM === undefined ? {} : { executablePath: process.env.WEBSKAT_CHROMIUM }),
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'node scripts/relay.mjs',
      port: RELAY_PORT,
      reuseExistingServer: process.env.CI === undefined,
      env: { PORT: String(RELAY_PORT) },
    },
    {
      command: `npx vite --port ${String(APP_PORT)} --strictPort`,
      url: APP_URL,
      reuseExistingServer: process.env.CI === undefined,
      env: { VITE_SIGNALING: 'ws-relay', VITE_RELAY_URL: RELAY_URL },
    },
  ],
});
