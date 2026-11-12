// Generates the table textures (docs/assets.md) with sharp from SVG filters, deterministic (fixed seeds):
//   public/felt-stamp.webp        the monochrome logo as a worn stamp mask (white + alpha) for the felt
//   public/textures/oak-old.webp  an old, used oak table top: planks, grain, knots, water rings, scratches
// The source logo public/skatastisches-logo-monochrome.png is read only. Outputs are committed;
// run `npm run textures` after changing this script.

import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const LOGO = 'public/skatastisches-logo-monochrome.png';
const STAMP = 'public/felt-stamp.webp';
const OAK = 'public/textures/oak-old.webp';

/** mulberry32: small seeded PRNG, so every run draws the same scratches. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => n.toFixed(1);

// ---------------------------------------------------------------- stamp

async function makeStamp() {
  const png = await readFile(LOGO);
  const { width, height } = await sharp(png).metadata();
  const href = `data:image/png;base64,${png.toString('base64')}`;
  // pressure: large soft patches where the stamp pressed less; specks: tiny holes; rough: wobbly edges.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <filter id="wear" x="0" y="0" width="${width}" height="${height}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="11" result="rough"/>
      <feDisplacementMap in="SourceGraphic" in2="rough" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="shaken"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="7" result="pressure"/>
      <feColorMatrix in="pressure" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.2 0 0 0 -0.1" result="pressureA"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="2" seed="3" result="speck"/>
      <feColorMatrix in="speck" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -24 0 0 0 18.6" result="speckA"/>
      <feComposite in="shaken" in2="pressureA" operator="in" result="pressed"/>
      <feComposite in="pressed" in2="speckA" operator="in" result="worn"/>
      <feGaussianBlur in="worn" stdDeviation="0.6" result="soft"/>
      <feColorMatrix in="soft" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/>
    </filter>
  </defs>
  <image href="${href}" width="${width}" height="${height}" filter="url(#wear)"/>
</svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 85, alphaQuality: 90 }).toFile(STAMP);
}

// ---------------------------------------------------------------- oak

const W = 1600;
const H = 1000;

function oakSvg() {
  const r = rng(1867);
  const defs = [];
  const body = [];

  // planks of uneven width; the first seam is at x = 0 so a repeat lands on a seam
  const planks = [];
  for (let x = 0; x < W; ) {
    const w = Math.min(W - x, 150 + Math.floor(r() * 120));
    planks.push({ x, w: W - x - w < 90 ? W - x : w });
    x += planks[planks.length - 1].w;
  }

  body.push(`<rect width="${W}" height="${H}" fill="#2e1c10"/>`);
  planks.forEach((p, i) => {
    const seed = 20 + i * 7;
    // grain runs along the plank (vertical): fast change across x, slow along y; filters cover only the plank
    const region = `x="${p.x}" y="0" width="${p.w}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"`;
    defs.push(`<filter id="g${i}" ${region}>
      <feTurbulence type="fractalNoise" baseFrequency="${(0.025 + r() * 0.02).toFixed(3)} 0.0022" numOctaves="3" seed="${seed}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.025  0 0 0 0 0.01  2.0 0 0 0 -0.8"/>
    </filter>
    <filter id="fg${i}" ${region}>
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.02" numOctaves="2" seed="${seed + 5}" result="w"/>
      <feTurbulence type="turbulence" baseFrequency="${(0.12 + r() * 0.08).toFixed(3)} 0.004" numOctaves="3" seed="${seed + 3}" result="n"/>
      <feDisplacementMap in="n" in2="w" scale="18" xChannelSelector="R" yChannelSelector="G" result="wavy"/>
      <feColorMatrix in="wavy" type="matrix" values="0 0 0 0 0.04  0 0 0 0 0.02  0 0 0 0 0.01  -4 0 0 0 1.1"/>
    </filter>
    <filter id="lg${i}" ${region}>
      <feTurbulence type="turbulence" baseFrequency="0.3 0.006" numOctaves="2" seed="${seed + 9}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.85  0 0 0 0 0.66  0 0 0 0 0.45  -3 0 0 0 0.75"/>
    </filter>`);
    defs.push(`<clipPath id="c${i}"><rect x="${p.x}" y="0" width="${p.w}" height="${H}"/></clipPath>`);
    // each plank its own tone: some redder, some grey and faded
    const tones = ['#4a2f1a', '#402713', '#52331e', '#47332a', '#3a2516', '#56402c', '#45301f', '#4b3a2c'];
    const tone = tones[Math.floor(r() * tones.length)];
    const shade = (0.2 + r() * 0.3).toFixed(2);
    body.push(`<g clip-path="url(#c${i})">
      <rect x="${p.x}" width="${p.w}" height="${H}" fill="${tone}"/>
      <rect x="${p.x}" width="${p.w}" height="${H}" filter="url(#g${i})"/>
      <rect x="${p.x}" width="${p.w}" height="${H}" filter="url(#fg${i})" opacity="0.45"/>
      <rect x="${p.x}" width="${p.w}" height="${H}" filter="url(#lg${i})" opacity="0.12"/>
      <rect x="${p.x}" width="${p.w}" height="${H}" fill="url(#plankShade)" opacity="${shade}"/>
    </g>`);
    // butt joint: planks are not one piece over the full height
    if (r() < 0.5) {
      const y = 120 + Math.floor(r() * (H - 240));
      body.push(`<rect x="${p.x}" y="${y}" width="${p.w}" height="2.5" fill="#0a0502" opacity="0.8"/>`);
      body.push(`<rect x="${p.x}" y="${y + 2.5}" width="${p.w}" height="1" fill="#c9a47a" opacity="0.08"/>`);
    }
  });
  defs.push(`<linearGradient id="plankShade" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity="0.7"/><stop offset="0.12" stop-color="#000" stop-opacity="0"/>
    <stop offset="0.85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.8"/></linearGradient>`);

  // seams between planks: a dark gap full of dirt, a lighter worn edge beside it
  planks.forEach((p) => {
    body.push(`<rect x="${p.x - 2}" y="0" width="4" height="${H}" fill="#070301" opacity="0.9"/>`);
    body.push(`<rect x="${p.x + 2}" y="0" width="1.2" height="${H}" fill="#d8b58a" opacity="0.07"/>`);
  });

  // knots: dark core, grain swirling around it (displaced rings)
  defs.push(`<filter id="wobble" x="-50%" y="-50%" width="200%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="0.8"/>
    </filter>
    <radialGradient id="knot"><stop offset="0" stop-color="#0c0603"/><stop offset="0.45" stop-color="#1f1108" stop-opacity="0.9"/><stop offset="1" stop-color="#1f1108" stop-opacity="0"/></radialGradient>`);
  for (let k = 0; k < 4; k++) {
    const x = 80 + r() * (W - 160);
    const y = 80 + r() * (H - 160);
    const rx = 9 + r() * 10;
    body.push(`<g filter="url(#wobble)" opacity="0.85">
      <ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(rx * 2.2)}" fill="url(#knot)"/>
      ${[1.6, 2.4, 3.3].map((s) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx * s)}" ry="${f(rx * s * 2.8)}" fill="none" stroke="#120904" stroke-width="2" opacity="0.5"/>`).join('')}
    </g>`);
  }

  // big worn and greasy areas: light where hands rest, dark grime elsewhere
  defs.push(`<filter id="blob" x="-50%" y="-50%" width="200%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="9" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="120" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="30"/>
    </filter>`);
  for (let b = 0; b < 9; b++) {
    const light = b % 3 === 0;
    body.push(`<ellipse cx="${f(r() * W)}" cy="${f(r() * H)}" rx="${f(120 + r() * 220)}" ry="${f(90 + r() * 160)}" fill="${light ? '#d0a46a' : '#050200'}" opacity="${light ? '0.13' : '0.26'}" filter="url(#blob)"/>`);
  }

  // water and beer rings: irregular, partly broken, a bleached inside, and some double rings
  defs.push(`<filter id="ring" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="13" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
    <filter id="stain" x="-50%" y="-50%" width="200%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="17" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="40" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="6"/>
    </filter>`);
  const rings = [];
  for (let i = 0; i < 11; i++) {
    const x = 60 + r() * (W - 120);
    const y = 60 + r() * (H - 120);
    const rad = 34 + r() * 30;
    rings.push([x, y, rad]);
    if (r() < 0.45) rings.push([x + (r() - 0.5) * 50, y + (r() - 0.5) * 50, rad * (0.9 + r() * 0.15)]);
  }
  for (const [x, y, rad] of rings) {
    const circ = 2 * Math.PI * rad;
    const gap = r() < 0.5 ? `stroke-dasharray="${f(circ * (0.55 + r() * 0.35))} ${f(circ)}" stroke-dashoffset="${f(r() * circ)}"` : '';
    // varnish bloom from wet glasses is whitish; beer and coffee leave dark rings
    const bloom = r() < 0.55;
    const color = bloom ? '#e6d6b8' : '#0b0502';
    const opacity = bloom ? 0.1 + r() * 0.1 : 0.35 + r() * 0.3;
    body.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad * 0.95)}" fill="${bloom ? '#d9c4a0' : '#b08758'}" opacity="${(bloom ? 0.04 + r() * 0.04 : 0.03).toFixed(3)}" filter="url(#stain)"/>`);
    body.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" fill="none" stroke="${color}" stroke-width="${f(2 + r() * 4)}" opacity="${opacity.toFixed(2)}" ${gap} filter="url(#ring)"/>`);
    body.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad - 4)}" fill="none" stroke="${color}" stroke-width="1" opacity="${(opacity * 0.4).toFixed(2)}" ${gap} filter="url(#ring)"/>`);
  }
  // spilled drinks: soft irregular dark stains
  for (let s = 0; s < 5; s++) {
    body.push(`<ellipse cx="${f(r() * W)}" cy="${f(r() * H)}" rx="${f(30 + r() * 70)}" ry="${f(20 + r() * 50)}" fill="#0a0502" opacity="${(0.18 + r() * 0.18).toFixed(2)}" filter="url(#stain)"/>`);
  }

  // cigarette burns
  defs.push(`<radialGradient id="burn"><stop offset="0" stop-color="#030100"/><stop offset="0.5" stop-color="#140904" stop-opacity="0.9"/><stop offset="1" stop-color="#2a1608" stop-opacity="0"/></radialGradient>`);
  for (let c = 0; c < 3; c++) {
    const x = r() * W;
    const y = r() * H;
    const a = r() * 180;
    body.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(14 + r() * 8)}" ry="${f(5 + r() * 3)}" transform="rotate(${f(a)} ${f(x)} ${f(y)})" fill="url(#burn)" filter="url(#ring)"/>`);
  }

  // dents from glasses and keys
  defs.push(`<filter id="dent"><feGaussianBlur stdDeviation="1.4"/></filter>`);
  for (let d = 0; d < 90; d++) {
    const x = r() * W;
    const y = r() * H;
    body.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(1.5 + r() * 4)}" ry="${f(1 + r() * 2.5)}" fill="#050200" opacity="${(0.25 + r() * 0.35).toFixed(2)}" filter="url(#dent)"/>`);
  }

  // scratches: many fine light ones, some deep gouges with a dark groove and a light lip
  const scratch = (x, y, len, ang, bend) => {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    const mx = (x + x2) / 2 + Math.cos(ang + Math.PI / 2) * bend;
    const my = (y + y2) / 2 + Math.sin(ang + Math.PI / 2) * bend;
    return `M${f(x)} ${f(y)} Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`;
  };
  const fine = [];
  for (let s = 0; s < 260; s++) {
    // most scratches follow a few favourite directions (cards dealt across the table)
    const base = [0.15, -0.35, 1.2, 2.6][Math.floor(r() * 4)];
    const ang = base + (r() - 0.5) * 0.6;
    const d = scratch(r() * W, r() * H, 8 + r() * r() * 160, ang, (r() - 0.5) * 12);
    fine.push(`<path d="${d}" stroke-width="${f(0.4 + r() * 0.9)}" stroke-opacity="${(0.06 + r() * 0.2).toFixed(2)}"/>`);
  }
  body.push(`<g fill="none" stroke="#ecd0a4" stroke-linecap="round">${fine.join('')}</g>`);
  const deep = [];
  for (let s = 0; s < 26; s++) {
    const ang = r() * Math.PI;
    const d = scratch(r() * W, r() * H, 20 + r() * 110, ang, (r() - 0.5) * 18);
    const w = 1.2 + r() * 1.6;
    deep.push(`<path d="${d}" stroke="#060301" stroke-width="${f(w)}" stroke-opacity="0.75"/>`);
    deep.push(`<path d="${d}" stroke="#e2c08e" stroke-width="0.8" stroke-opacity="0.18" transform="translate(0.8 1.4)"/>`);
  }
  body.push(`<g fill="none" stroke-linecap="round">${deep.join('')}</g>`);

  // overall dirt: fine dark noise, darker towards the edges
  defs.push(`<filter id="dirt" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="31" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.02  0 0 0 0 0.01  0 0 0 0 0  1.4 0 0 0 -0.66"/>
    </filter>
    <radialGradient id="edge" cx="0.5" cy="0.45" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>`);
  body.push(`<rect width="${W}" height="${H}" filter="url(#dirt)"/>`);
  body.push(`<rect width="${W}" height="${H}" fill="url(#edge)"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${defs.join('\n')}</defs>${body.join('\n')}</svg>`;
}

async function makeOak() {
  await mkdir('public/textures', { recursive: true });
  await sharp(Buffer.from(oakSvg())).webp({ quality: 80 }).toFile(OAK);
}

await makeStamp();
await makeOak();
console.log(`textures: wrote ${STAMP}, ${OAK}`);
