// Downscales cut-outs from _lokal/extracted/ into assets/ (headless Chromium canvas, no extra deps).
// Usage: node tools/build-raster-assets.mjs
import fs from 'node:fs';
import { openBrowser, decodePng } from './sprite-lib.mjs';

const AVATARS = ['astronaut', 'monster', 'superhero', 'knight', 'dino', 'dragon', 'pony', 'taco', 'singer', 'cat', 'fairy', 'chef'];
const DECOR = ['star-big', 'badge-winner', 'bubble-yay', 'bubble-wow', 'confetti-1', 'confetti-2', 'confetti-3', 'confetti-4', 'confetti-5', 'confetti-6'];

const jobs = [
  ...AVATARS.map((a) => ({ from: `avatars/${a}.png`, to: `avatars/${a}.png`, square: 256 })),
  ...DECOR.map((d) => ({ from: `decor/${d}.png`, to: `decor/${d}.png`, max: 320 })),
  { from: 'mascot/robot-wave.png', to: 'mascot/robot-wave.png', max: 400 },
];

const { browser, page } = await openBrowser();
for (const j of jobs) {
  const buf = fs.readFileSync(`_lokal/extracted/${j.from}`);
  const { w, h } = await decodePng(page, buf);
  let outW, outH;
  if (j.square) { outW = outH = j.square; } else {
    const k = Math.min(1, j.max / Math.max(w, h));
    outW = Math.round(w * k); outH = Math.round(h * k);
  }
  const out = await page.evaluate(async ({ b64, outW, outH }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = outW; c.height = outH;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, outW, outH);
    return c.toDataURL('image/png').split(',')[1];
  }, { b64: buf.toString('base64'), outW, outH });
  fs.mkdirSync(`assets/${j.to.split('/')[0]}`, { recursive: true });
  fs.writeFileSync(`assets/${j.to}`, Buffer.from(out, 'base64'));
  console.log(j.to, `${w}x${h} -> ${outW}x${outH}`);
}
await browser.close();
