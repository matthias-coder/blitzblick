// Downscales cut-outs from _lokal/extracted/ into assets/ as WebP (headless Chromium canvas, no extra deps).
// Usage: node tools/build-raster-assets.mjs
import fs from 'node:fs';
import { openBrowser, decodePng } from './sprite-lib.mjs';
import { BASE_OBJECTS } from '../js/exercises/quantity.js';
import { PAGES, SECRET_PAGE } from '../js/rewards.js';

const AVATARS = ['astronaut', 'monster', 'superhero', 'knight', 'dino', 'dragon', 'pony', 'taco', 'singer', 'cat', 'fairy', 'chef'];
const DECOR = ['star-big', 'badge-winner', 'bubble-yay', 'bubble-wow', 'confetti-1', 'confetti-2', 'confetti-3', 'confetti-4', 'confetti-5', 'confetti-6', 'medal'];
const MASCOT = ['robot-wave', 'robot-cheer', 'robot-trophy'];
const MENU = ['quantity', 'digits', 'letters', 'syllables'];
const QUALITY = 0.85;
const PLACEHOLDERS = ['decor/medal', 'mascot/robot-trophy'];

const jobs = [
  ...AVATARS.map((a) => ({ name: `avatars/${a}`, square: 256 })),
  ...DECOR.map((d) => ({ name: `decor/${d}`, max: 320 })),
  ...MASCOT.map((m) => ({ name: `mascot/${m}`, max: 400 })),
  ...MENU.map((m) => ({ name: `menu/${m}`, square: 320 })),
  ...BASE_OBJECTS.map((o) => ({ name: `objects/${o}`, square: 256 })),
  ...[...PAGES, SECRET_PAGE].flatMap((p) => p.stickers.map((s) => ({ name: `stickers/${p.id}/${s}`, square: 256 }))),
];

const { browser, page } = await openBrowser();
let total = 0;
for (const j of jobs) {
  const src = `_lokal/extracted/${j.name}.png`;
  // v1.7 level celebration: until the artwork is cut, assets/ keeps its committed placeholder
  if (!fs.existsSync(src) && PLACEHOLDERS.includes(j.name)) { console.log('placeholder kept:', j.name); continue; }
  const buf = fs.readFileSync(src);
  const { w, h } = await decodePng(page, buf);
  let outW, outH;
  if (j.square) { outW = outH = j.square; } else {
    const k = Math.min(1, j.max / Math.max(w, h));
    outW = Math.round(w * k); outH = Math.round(h * k);
  }
  const out = await page.evaluate(async ({ b64, outW, outH, q }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = outW; c.height = outH;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, outW, outH);
    return c.toDataURL('image/webp', q).split(',')[1];
  }, { b64: buf.toString('base64'), outW, outH, q: QUALITY });
  const file = `assets/${j.name}.webp`;
  fs.mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  fs.writeFileSync(file, Buffer.from(out, 'base64'));
  total += fs.statSync(file).size;
}
console.log(`${jobs.length} files, ${(total / 1024).toFixed(0)} KB`);
await browser.close();
