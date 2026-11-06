# 10 — Assets

Originals (read-only, **never modify or delete**):

| File | Size | Content |
|---|---|---|
| `assets/PlayingCards 128x178.png` | 1664 × 712, 16-bit RGBA, interlaced, 9.5 MB | 13 columns × 4 rows of 128 × 178 px cards |
| `assets/Card Backs 128x178.png` | 512 × 178, 16-bit RGBA | 4 card backs, 128 px each, side by side |

Geometry was verified during planning (cropping `J♣` at x=1280,y=0; `7♦` at x=768,y=534; third back
at x=256).

## Sprite layout

**Rows** (top → bottom): `0 = Clubs (C)`, `1 = Hearts (H)`, `2 = Spades (S)`, `3 = Diamonds (D)`.

**Columns** (left → right): `0=A, 1=2, 2=3, 3=4, 4=5, 5=6, 6=7, 7=8, 8=9, 9=10, 10=J, 11=Q, 12=K`.

Skat only uses `7 8 9 10 J Q K A`, i.e. columns `6..12` and `0`. Columns for 2–6 are ignored.

```ts
const COLUMN_OF_RANK = { A: 0, '7': 6, '8': 7, '9': 8, '10': 9, J: 10, Q: 11, K: 12 } as const;
const ROW_OF_SUIT    = { C: 0, H: 1, S: 2, D: 3 } as const;
// crop: left = col * 128, top = row * 178, width 128, height 178
```

Backs: index `0` dark-blue ornate, `1` light red/white, `2` dark red (default), `3` navy/white.
`left = index * 128`, `top = 0`.

## Generated files (`public/`, git-ignored, produced by `npm run assets`)

```
public/cards/CJ.webp  CS… → naming = CardId + .webp:  C7 C8 C9 C10 CJ CQ CK CA, S…, H…, D…   (32 files)
public/backs/0.webp 1.webp 2.webp 3.webp                                                      (4 files)
```
Format: WebP, 8-bit, quality 90, `alphaQuality: 100` (keep transparent rounded corners), 128 × 178.
Expected total well under 1 MB.

## `scripts/make-assets.mjs` (sketch)

```js
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const W = 128, H = 178;
const CARDS = 'assets/PlayingCards 128x178.png';
const BACKS = 'assets/Card Backs 128x178.png';
const cols = { A: 0, 7: 6, 8: 7, 9: 8, 10: 9, J: 10, Q: 11, K: 12 };
const rows = { C: 0, H: 1, S: 2, D: 3 };

await mkdir('public/cards', { recursive: true });
await mkdir('public/backs', { recursive: true });

for (const [suit, row] of Object.entries(rows))
  for (const [rank, col] of Object.entries(cols))
    await sharp(CARDS)
      .extract({ left: col * W, top: row * H, width: W, height: H })
      .toColourspace('srgb')               // 16-bit → default 8-bit output
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(`public/cards/${suit}${rank}.webp`);

for (let i = 0; i < 4; i++)
  await sharp(BACKS)
    .extract({ left: i * W, top: 0, width: W, height: H })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`public/backs/${i}.webp`);

console.log('assets: 32 cards + 4 backs written to public/');
```
Requirements: idempotent (overwrites), exits non-zero on error, skips work if all 36 outputs exist
and are newer than the inputs (optional). Hook it up as `"predev"`/`"prebuild"` only when
`public/cards/CA.webp` is missing.

If `sharp` cannot be installed, an equivalent ImageMagick command (verified available on the
planning machine) is:
```sh
convert "assets/PlayingCards 128x178.png" -crop 128x178+1280+0 +repage -depth 8 public/cards/CJ.png
```
(then use PNG instead of WebP and adjust `Card` image extension in one place: `ui/assets.ts`).

## Usage in the UI

```ts
// src/ui/assets.ts
export const cardUrl = (id: CardId) => `${import.meta.env.BASE_URL}cards/${id}.webp`;
export const backUrl = (i: 0 | 1 | 2 | 3) => `${import.meta.env.BASE_URL}backs/${i}.webp`;
```
- Always use `import.meta.env.BASE_URL` (deployment may be under a sub-path).
- Preload all 32 faces + the chosen back after the first view arrives
  (`new Image().src = …`) so the first hand renders without flicker.
- `<img width=128 height=178 decoding="async" draggable="false" alt="…">`.
- Suit symbols for text are Unicode: ♣ ♠ ♥ ♦ (Clubs, Spades, Hearts, Diamonds).

## Not provided

No sounds, no table texture, no logo. Favicon: a simple inline SVG (♠ on green) in `public/favicon.svg`.
Card art licensing is the user's responsibility (assets were provided by the user).
