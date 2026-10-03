// Shared pixel helpers for extract-sprites.mjs (Node + headless Chromium canvas for decode/encode/resize).
import { chromium } from '@playwright/test';
import fs from 'node:fs';

export async function openBrowser() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<canvas id=c></canvas>');
  return { browser, page };
}

export async function decode(page, file) {
  const b64 = fs.readFileSync(file).toString('base64');
  const r = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let s = ''; const CH = 0x8000;
    for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
    return { w: c.width, h: c.height, b64: btoa(s) };
  }, b64);
  return { w: r.w, h: r.h, data: new Uint8ClampedArray(Buffer.from(r.b64, 'base64')) };
}

// RGBA buffer (w*h*4) -> PNG buffer, optionally scaled to outW x outH
export async function encodePng(page, rgba, w, h, outW = w, outH = h) {
  const b64 = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.length).toString('base64');
  const out = await page.evaluate(async ({ b64, w, h, outW, outH }) => {
    const bin = atob(b64); const u = new Uint8ClampedArray(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    src.getContext('2d').putImageData(new ImageData(u, w, h), 0, 0);
    const dst = document.createElement('canvas'); dst.width = outW; dst.height = outH;
    const x = dst.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, outW, outH);
    return dst.toDataURL('image/png').split(',')[1];
  }, { b64, w, h, outW, outH });
  return Buffer.from(out, 'base64');
}

export async function decodePng(page, buf) {
  const b64 = buf.toString('base64');
  const r = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let s = ''; const CH = 0x8000;
    for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
    return { w: c.width, h: c.height, b64: btoa(s) };
  }, b64);
  return { w: r.w, h: r.h, data: new Uint8ClampedArray(Buffer.from(r.b64, 'base64')) };
}

// Background mask: flood fill from border over "light, low-saturation" pixels.
// isBg(r,g,b) decides which pixels may be background. Returns Uint8Array 1 = background.
export function floodBg(img, isBg, seeds = null) {
  const { w, h, data } = img;
  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (bg[i]) return;
    const p = i * 4;
    if (!isBg(data[p], data[p + 1], data[p + 2])) return;
    bg[i] = 1; stack.push(i);
  };
  if (seeds) seeds.forEach(([x, y]) => push(x, y));
  else {
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  }
  while (stack.length) {
    const i = stack.pop(); const x = i % w, y = (i / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return bg;
}

export const lightGrey = (lightMin = 200, satMax = 38) => (r, g, b) => {
  const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
  return mn >= lightMin && mx - mn <= satMax;
};

// Connected components (8-conn) over mask==1. Returns {labels, comps:[{id,area,x0,y0,x1,y1,cx,cy}]}
export function components(mask, w, h) {
  const labels = new Int32Array(w * h);
  const comps = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || labels[s]) continue;
    const id = comps.length + 1;
    const c = { id, area: 0, x0: w, y0: h, x1: 0, y1: 0, sx: 0, sy: 0 };
    labels[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop(); const x = i % w, y = (i / w) | 0;
      c.area++; c.sx += x; c.sy += y;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (mask[j] && !labels[j]) { labels[j] = id; stack.push(j); }
      }
    }
    c.cx = c.sx / c.area; c.cy = c.sy / c.area;
    comps.push(c);
  }
  return { labels, comps };
}

export function dilate(mask, w, h, r = 1) {
  let cur = mask;
  for (let k = 0; k < r; k++) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (cur[i]) { out[i] = 1; continue; }
      if ((x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w])) out[i] = 1;
    }
    cur = out;
  }
  return cur;
}
export function erode(mask, w, h, r = 1) {
  const inv = new Uint8Array(w * h); for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
  // treat outside image as background-free: only erode against in-image bg
  const d = dilate(inv, w, h, r); const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i] ? 0 : mask[i];
  return out;
}

// Build RGBA sprite from a region: fg = Uint8Array(w*h) 1 where pixel belongs to sprite.
// Erodes 1px (kills JPEG/white fringe), feathers alpha with 3x3 box blur, extends edge colours outwards (no halo).
// Returns {w,h,data} for the bbox region [x0..x1]x[y0..y1] (inclusive) with 3px margin included.
export function makeSprite(img, fg, box, { erodePx = 1 } = {}) {
  const { w, data } = img;
  const m = 3;
  const x0 = Math.max(0, box.x0 - m), y0 = Math.max(0, box.y0 - m);
  const x1 = Math.min(img.w - 1, box.x1 + m), y1 = Math.min(img.h - 1, box.y1 + m);
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  let M = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) M[y * W + x] = fg[(y + y0) * w + x + x0];
  const core = erodePx ? erode(M, W, H, erodePx) : M;
  const rgb = new Float32Array(W * H * 3);
  const known = new Uint8Array(core);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = ((y + y0) * w + x + x0) * 4;
    rgb[i * 3] = data[p]; rgb[i * 3 + 1] = data[p + 1]; rgb[i * 3 + 2] = data[p + 2];
  }
  // colour extension (2 iterations)
  let kn = known;
  for (let it = 0; it < 3; it++) {
    const nk = new Uint8Array(kn);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (kn[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (!kn[j]) continue;
        r += rgb[j * 3]; g += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; n++;
      }
      if (n) { rgb[i * 3] = r / n; rgb[i * 3 + 1] = g / n; rgb[i * 3 + 2] = b / n; nk[i] = 1; }
    }
    kn = nk;
  }
  // alpha: 3x3 box blur of core
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      s += core[ny * W + nx];
    }
    const a = s / 9; const i = y * W + x;
    out[i * 4] = rgb[i * 3]; out[i * 4 + 1] = rgb[i * 3 + 1]; out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = kn[i] ? Math.round(255 * Math.min(1, a * 1.6)) : 0;
  }
  return { w: W, h: H, data: out };
}

// Tight alpha bbox
export function alphaBox(s, thr = 8) {
  let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (s.data[(y * s.w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, y0, x1, y1 };
}

// Center sprite on square transparent canvas with pad fraction around the larger side
export function squarePad(s, pad = 0.04) {
  const b = alphaBox(s);
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const side = Math.ceil(Math.max(bw, bh) * (1 + 2 * pad));
  const out = new Uint8ClampedArray(side * side * 4);
  const ox = Math.floor((side - bw) / 2) - b.x0, oy = Math.floor((side - bh) / 2) - b.y0;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    const p = (y * s.w + x) * 4, q = ((y + oy) * side + x + ox) * 4;
    out[q] = s.data[p]; out[q + 1] = s.data[p + 1]; out[q + 2] = s.data[p + 2]; out[q + 3] = s.data[p + 3];
  }
  return { w: side, h: side, data: out };
}

export function trim(s, pad = 2) {
  const b = alphaBox(s);
  const W = b.x1 - b.x0 + 1 + 2 * pad, H = b.y1 - b.y0 + 1 + 2 * pad;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    const p = (y * s.w + x) * 4, q = ((y - b.y0 + pad) * W + x - b.x0 + pad) * 4;
    for (let k = 0; k < 4; k++) out[q + k] = s.data[p + k];
  }
  return { w: W, h: H, data: out };
}
