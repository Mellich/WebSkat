# Assets

## 1. Originals (`assets/`, read-only: **never modify or delete**)

| File | Content |
|---|---|
| `assets/PlayingCards 128x178.png` | 1664 × 712 sprite sheet: 13 columns × 4 rows of 128 × 178 px cards (16-bit RGBA) |
| `assets/Card Backs 128x178.png` | 512 × 178: 4 backs side by side |
| `assets/Das Skatastische Logo.PNG` | raster logo; its unchanged copy is `public/skatastisches-logo.png` (Home header + favicon) |
| `assets/Skatastischer Hirsch.svg` | vector logo, kept unchanged (copy in `public/skatastischer-hirsch.svg`, not used by the app) |
| `assets/skatastisches-logo-monochrome.svg` | monochrome club logo (Inkscape, 2 MB; source for editing); its export is `public/skatastisches-logo-monochrome.png` (800 × 566, transparent), the input of the felt stamp (§5) |

Card art licensing is the user's responsibility (supplied by the user).

## 2. Sprite layout

Rows (top → bottom): `0 = Clubs`, `1 = Hearts`, `2 = Spades`, `3 = Diamonds`.
Columns: `0 = A`, `1–5 = 2–6` (unused), `6 = 7`, `7 = 8`, `8 = 9`, `9 = 10`, `10 = J`, `11 = Q`,
`12 = K`. Crop: `left = col × 128`, `top = row × 178`, 128 × 178.

Backs: index 0 dark-blue ornate, 1 light red/white, 2 dark red (default), 3 navy/white;
`left = index × 128`.

## 3. Generated files (`public/cards`, `public/backs`; git-ignored)

`scripts/make-assets.mjs` (via `sharp`) writes 32 faces `public/cards/<CardId>.webp` (e.g.
`CJ.webp`, `S10.webp`) and 4 backs `public/backs/0..3.webp`: WebP, quality 90, `alphaQuality:
100`, 128 × 178.

- `npm run assets` always regenerates.
- `predev` / `prebuild` run it with `--if-missing` (skips when all outputs exist).

## 4. Usage in the UI (`src/ui/assets.ts`)

`cardUrl(id)`, `backUrl(index)`, `logoUrl()` build URLs from `import.meta.env.BASE_URL`, so a
deployment under a sub-path works. Never hard-code `/cards/...`. Suit symbols in text are Unicode
♣ ♠ ♥ ♦ (♥ ♦ red, `--suit-red`). No sounds exist. `stampUrl()` gives the felt stamp (§5); CSS
files may reference public files by root path (`url('/textures/oak-old.webp')`, like the fonts):
Vite rewrites those for the relative `base`.

## 5. Table textures (`public/felt-stamp.webp`, `public/textures/oak-old.webp`; committed)

`scripts/make-textures.mjs` (`npm run textures`, via `sharp`) renders both from SVG filters with fixed
seeds, so a run gives the same files. They are committed (not part of `predev`/`prebuild`); rerun the
script after changing it. One run takes about a minute.

| File | Content | Used by |
|---|---|---|
| `public/felt-stamp.webp` | the monochrome logo as a white + alpha mask, worn like a used stamp: soft patches of less pressure, a few small holes, slightly wobbly edges (≈ 90 kB) | `TableCenter` (`.stamp`, a CSS `mask` over a darker baize with a light lip and a shadow: the logo looks pressed into the felt) |
| `public/textures/oak-old.webp` | 1600 × 1000 old oak table top: planks of uneven width and tone, dark seams, butt joints, wavy grain, knots, whitish water marks and dark beer rings, spills, cigarette burns, dents, fine scratches and deep gouges, worn and greasy patches (≈ 170 kB) | `body` background in `global.css` (`cover`, under a lamp glow and darker corners) |
