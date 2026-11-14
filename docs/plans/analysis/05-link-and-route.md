# Step 05: analysis link, route and screen stub

**Kind:** feature. **Layers:** ui (net: one export). **Protocol:** no. **Needs:** step 03.

## Read first

- `docs/ui.md` §1 (routes), `src/ui/AGENTS.md`
- `src/ui/router.ts`, `src/App.tsx` (lazy `ChangelogScreen` is the model), `src/ui/router.test.ts`
- `src/net/schemaGame.ts` (`CardIdSchema`, `DeclarationSchema`), `src/net/schemaView.ts`
  (`DoubleLevelSchema` or similar), `src/net/index.ts`
- `src/ui/persist/settings.ts` (how zod is used in the UI)

## Why

The analysis opens in a **new tab**. A new tab is a fresh page: it has no session store and no
connection. The finished game therefore travels inside the URL hash:

```
<origin><path>#/analysis?g=<base64url(JSON of AnalysisInput)>
```

About 1–1.5 kB; no storage, no network, and the link keeps working when bookmarked. URL data is
external input, so it is validated with zod and then replayed by the engine (`validateInput`)
before anything is shown.

## Changes

### 1. Schemas reachable from the UI

If `CardIdSchema` / `DeclarationSchema` / the double-level schema are not exported from
`src/net/index.ts`, add `export { CardIdSchema, DeclarationSchema } from './schemaGame';`
`DoubleLevelSchema` is a private `const` in `src/net/schemaView.ts` today: export it there and
re-export it from `src/net/index.ts` as well. Do not deep-import `src/net/schema*.ts` from the UI.

### 2. `src/ui/analysis/inputSchema.ts`

```ts
// zod schema of the analysis link data (AGENTS.md hard rule 4: validate external data).
const role = z.enum(['forehand', 'middlehand', 'hindhand']);
const byRole = <T extends z.ZodTypeAny>(v: T) => z.object({ forehand: v, middlehand: v, hindhand: v });

export const AnalysisInputSchema: z.ZodType<AnalysisInput> = z.object({
  version: z.literal(1),
  kind: z.enum(['played', 'ramsch', 'passed-in']),
  names: byRole(z.string().max(40)),
  hands: byRole(z.array(CardIdSchema).length(10)),
  skat: z.array(CardIdSchema).length(2),
  declarer: role.nullable(),
  declaration: DeclarationSchema.nullable(),
  bid: z.number().int().nullable(),
  pickedUpSkat: z.boolean(),
  discarded: z.array(CardIdSchema).max(2),
  doubling: DoubleLevelSchema,
  bidding: z.array(z.object({ role, type: z.enum(['bid', 'hold', 'pass', 'claim']), value: z.number().int().optional() })).max(200),
  plays: z.array(CardIdSchema).max(30),
});
```

(Type the helper so it compiles under strict rules; if the generic helper is awkward, write the
three keys out.)

### 3. `src/ui/analysis/link.ts`

```ts
/** JSON → UTF-8 bytes → base64url (no padding). Names may contain any Unicode. */
export function encodeAnalysis(input: AnalysisInput): string;
/** The inverse; null for anything that is not a valid AnalysisInput (never throws). */
export function decodeAnalysis(text: string): AnalysisInput | null;
export function analysisHash(input: AnalysisInput): string; // '#/analysis?g=' + encodeAnalysis(input)
/** Absolute URL of the analysis in the current app (same origin and path, new hash). */
export function analysisUrl(input: AnalysisInput, location: Pick<Location, 'origin' | 'pathname'>): string;
/** Opens the analysis of `input` in a new tab. */
export function openAnalysis(input: AnalysisInput): void; // window.open(analysisUrl(input, window.location), '_blank', 'noopener')
```

- Encoding: `new TextEncoder().encode(JSON.stringify(input))`, bytes → binary string (loop with
  `String.fromCharCode`, not spread, to avoid stack limits) → `btoa` → replace `+`→`-`, `/`→`_`,
  strip `=`.
- Decoding: reverse inside `try { … } catch { return null; }`, `JSON.parse` as `unknown`,
  `AnalysisInputSchema.safeParse`, then `validateInput(input).ok` (from `src/table`) – return
  `null` if anything fails.

### 4. Route

`src/ui/router.ts`:

```ts
| { readonly kind: 'analysis'; readonly data: string | null }
```

In `parseRoute`: `if (path === '/analysis') return { kind: 'analysis', data: new URLSearchParams(query).get('g') };`
(Note: `parseRoute` splits on the first `?` with `split('?', 2)`; base64url has no `?`, so this is fine.)

`src/App.tsx`: lazy import like `ChangelogScreen`:

```ts
const AnalysisScreen = lazy(async () => {
  const module = await import('./ui/analysis/AnalysisScreen');
  return { default: module.AnalysisScreen };
});
// case 'analysis': return <AnalysisScreen data={route.data} />;
```

Hide the `VersionBadge` on the analysis route as on the changelog route only if it overlaps the
layout in step 07; otherwise keep it.

### 5. Screen stub `src/ui/analysis/AnalysisScreen.tsx`

For this step only: decode `data`; if `null` → show `t('analysis.invalid')` and a link "Home"
(`href="#/"`, text `t('analysis.home')`); else show the title `t('analysis.title')`. Root element
`data-testid="analysis-screen"`, error element `data-testid="analysis-invalid"`. Step 07 fills it.

Create the i18n part files now (they grow in step 07):

- `src/ui/i18n/parts/enAnalysis.ts` / `deAnalysis.ts`, merged in `src/ui/i18n/en.ts` / `de.ts`
  like the other parts (look at how `enLog`/`deLog` are typed and merged).
- `analysis.title`: Game analysis / Spielanalyse
- `analysis.invalid`: This analysis link is invalid or incomplete. / Dieser Analyse-Link ist ungültig oder unvollständig.
- `analysis.home`: To the start page / Zur Startseite

## Tests first

`src/ui/analysis/link.test.ts` (node environment is fine; `TextEncoder`/`btoa` exist in Node 22):

1. Round trip: an input built from a finished game (reuse the helper approach of step 03 tests:
   `src/table/testing.ts` + `viewFor` + `analysisInputFromView`) → `decodeAnalysis(encodeAnalysis(x))`
   `toEqual` x. Include a name with umlauts and an emoji.
2. The encoded string matches `/^[A-Za-z0-9_-]+$/`.
3. `decodeAnalysis('')`, `'%%%'`, base64 of `{"version":2}`, and an input with a duplicated card
   (passes zod, fails `validateInput`) → `null`.
4. `analysisUrl(x, { origin: 'https://a.b', pathname: '/WebSkat/' })` starts with
   `https://a.b/WebSkat/#/analysis?g=`.

`src/ui/router.test.ts`: `#/analysis?g=abc` → `{ kind: 'analysis', data: 'abc' }`; `#/analysis`
→ `data: null`.

`src/ui/analysis/AnalysisScreen.test.tsx` (jsdom pragma as in other component tests):
invalid data shows `analysis-invalid`; valid data shows `analysis-screen` without the error.

Run: `npx vitest run src/ui/analysis src/ui/router.test.ts`

## Docs

- `docs/ui.md` §1 routes: `#/analysis?g=…` (all builds, lazy).
- `src/ui/AGENTS.md` file map: `analysis/` rows; `router.ts` row mentions the analysis route.
- `docs/dev/e2e.md` §6: `analysis-screen`, `analysis-invalid`.
- `docs/decisions.md`: row "Analysis link" (README §3).

## Done when

`npm run check` is green; `npm run build` succeeds (the screen is a separate lazy chunk).
