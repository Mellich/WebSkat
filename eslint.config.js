import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Pure layers: no UI/network libraries, no browser or time/randomness globals.
const PURE_GLOBALS = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'fetch',
  'WebSocket',
  'RTCPeerConnection',
  'crypto',
  'Date',
  'setTimeout',
  'setInterval',
  'performance',
];

const PURE_LIBRARY_PATTERNS = [
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
  'zustand',
  'zustand/*',
  'trystero',
  'trystero/*',
  '@trystero-p2p/*',
];

const UI_PATTERNS = ['**/ui', '**/ui/**'];
const NET_PATTERNS = ['**/net', '**/net/**'];
const TABLE_PATTERNS = ['**/table', '**/table/**'];

export default tseslint.config(
  {
    ignores: ['dist', 'public', 'coverage', 'test-results', 'playwright-report'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.core.json', './tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: ['src/engine/**/*.ts', 'src/table/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-globals': ['error', ...PURE_GLOBALS],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded rng in src/engine/rng.ts.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: PURE_LIBRARY_PATTERNS,
              message: 'Engine and table are pure TypeScript; no UI, state or network libraries.',
            },
            {
              group: [...UI_PATTERNS, ...NET_PATTERNS],
              message: 'Layering: table must not import net or ui (see docs/02-architecture.md).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: PURE_LIBRARY_PATTERNS,
              message: 'Engine is pure TypeScript; no UI, state or network libraries.',
            },
            {
              group: ['zod', 'zod/*'],
              message: 'Engine must not depend on zod (validation lives in src/net).',
            },
            {
              group: [...TABLE_PATTERNS, ...NET_PATTERNS, ...UI_PATTERNS],
              message: 'Layering: engine must not import table, net or ui.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/net/**/*.ts', 'src/net/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: UI_PATTERNS,
              message: 'Layering: net must not import ui.',
            },
          ],
        },
      ],
    },
  },
);
