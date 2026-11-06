// Crops the provided sprite sheets in assets/ into public/cards/*.webp and public/backs/*.webp
// (docs/10-assets.md). The originals are read only. Idempotent: outputs are overwritten.
// `--if-missing` skips the work when the outputs already exist (used by predev/prebuild).

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const W = 128;
const H = 178;
const CARDS = 'assets/PlayingCards 128x178.png';
const BACKS = 'assets/Card Backs 128x178.png';
const COLUMNS = { A: 0, 7: 6, 8: 7, 9: 8, 10: 9, J: 10, Q: 11, K: 12 };
const ROWS = { C: 0, H: 1, S: 2, D: 3 };
const BACK_COUNT = 4;

const outputs = [
  ...Object.keys(ROWS).flatMap((suit) => Object.keys(COLUMNS).map((rank) => `public/cards/${suit}${rank}.webp`)),
  ...Array.from({ length: BACK_COUNT }, (_, i) => `public/backs/${String(i)}.webp`),
];

if (process.argv.includes('--if-missing') && outputs.every((file) => existsSync(file))) {
  console.log('assets: already present, skipping');
  process.exit(0);
}

const webp = { quality: 90, alphaQuality: 100 };

await mkdir('public/cards', { recursive: true });
await mkdir('public/backs', { recursive: true });

for (const [suit, row] of Object.entries(ROWS)) {
  for (const [rank, column] of Object.entries(COLUMNS)) {
    await sharp(CARDS)
      .extract({ left: column * W, top: row * H, width: W, height: H })
      .toColourspace('srgb')
      .webp(webp)
      .toFile(`public/cards/${suit}${rank}.webp`);
  }
}

for (let i = 0; i < BACK_COUNT; i++) {
  await sharp(BACKS)
    .extract({ left: i * W, top: 0, width: W, height: H })
    .toColourspace('srgb')
    .webp(webp)
    .toFile(`public/backs/${String(i)}.webp`);
}

console.log(`assets: ${String(outputs.length)} images written to public/`);
