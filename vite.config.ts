import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// The app version comes from package.json (docs/dev/versioning.md); src/ui/version.ts reads it.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
