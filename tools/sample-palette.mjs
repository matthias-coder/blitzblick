// Samples the colour scheme from the tablet mockups (5x5 mean around fixed points). Usage: node tools/sample-palette.mjs
import { openBrowser, decode } from './sprite-lib.mjs';
const { browser, page } = await openBrowser();
const A = await decode(page, '_lokal/source/157d5d0a-8431-43d4-a73f-4be959194115.jpg'); // Mathe lesson
const B = await decode(page, '_lokal/source/30d1605b-033e-468d-8e46-535700b3b21c.jpg'); // home
const hex = (c) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const at = (img, x, y, r = 2) => { let s = [0, 0, 0], n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const p = ((y + dy) * img.w + x + dx) * 4; for (let k = 0; k < 3; k++) s[k] += img.data[p + k]; n++; } return hex(s.map(v => v / n)); };
const dark = (img, [x0, y0, x1, y1]) => { const px = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = (y * img.w + x) * 4, l = .3 * img.data[p] + .59 * img.data[p + 1] + .11 * img.data[p + 2]; if (l < 80) px.push([img.data[p], img.data[p + 1], img.data[p + 2]]); } const m = (k) => px.map(c => c[k]).sort((a, b) => a - b)[px.length >> 1]; return hex([m(0), m(1), m(2)]) + ` (n=${px.length})`; };
const yel = (img, [x0, y0, x1, y1]) => { const px = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = (y * img.w + x) * 4, r = img.data[p], g = img.data[p + 1], b = img.data[p + 2]; if (r > 220 && g > 160 && g < 215 && b < 120) px.push([r, g, b]); } const m = (k) => px.map(c => c[k]).sort((a, b) => a - b)[px.length >> 1]; return hex([m(0), m(1), m(2)]) + ` (n=${px.length})`; };
const out = {
  'page bg (top-left, mockup)': at(B, 40, 40), 'page bg (screen content area)': at(B, 160, 800),
  'header gradient start (left)': at(B, 150, 235), 'header gradient mid': at(B, 400, 235), 'header gradient end (right)': at(B, 605, 235),
  'header solid purple (Mathe lesson)': at(A, 400, 235),
  'card purple (Mathe)': at(B, 560, 410), 'card blue (Sprachen)': at(B, 560, 570), 'card coral (Wissenschaft)': at(B, 360, 720),
  'progress green': at(B, 390, 391), 'progress green (Sprachen)': at(B, 440, 547), 'progress purple (Wissenschaft)': at(B, 360, 704),
  'progress purple (lesson)': at(A, 300, 806), 'track grey (card)': at(B, 520, 391), 'track grey (lesson)': at(A, 495, 806),
  'yellow (calc icon / bubble, median of yellow px)': yel(B, [200, 320, 300, 400]), 'yellow (speech bubble)': yel(B, [205, 480, 260, 540]),
  'blue shape (circle)': at(A, 297, 662), 'purple shape (square)': at(A, 382, 662), 'red shape (triangle)': at(A, 468, 675),
  'dark navy text (Lektion)': dark(A, [225, 310, 540, 390]),
};
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(36), v);
await browser.close();
