// Generates the hand-drawn SVG set (ui icons, app icon) into assets/.
// Usage: node tools/gen-svgs.mjs   (output is committed; this script is the source of truth for redraws)
import fs from 'node:fs';

const ROOT = new URL('../assets/', import.meta.url);
const INK = '#2D2A5D';
const n = (v) => +v.toFixed(1);
const star = (cx, cy, ro, ri, k = 5) => Array.from({ length: k * 2 }, (_, i) => { const a = (-90 + i * 180 / k) * Math.PI / 180, rr = i % 2 ? ri : ro; return `${n(cx + rr * Math.cos(a))},${n(cy + rr * Math.sin(a))}`; }).join(' ');
const svg = (b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${b}</svg>\n`;
const out = (path, b) => { const u = new URL(path, ROOT); fs.mkdirSync(new URL('.', u), { recursive: true }); fs.writeFileSync(u, svg(b)); };

// ---- ui icons (single ink colour)
const sw = (d, w = 11) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const solid = `fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
out('ui/back.svg', sw('M82 50H24M46 24L20 50l26 26', 12));
out('ui/check.svg', sw('M16 54l24 24 44-52', 14));
out('ui/gear.svg', Array.from({ length: 8 }, (_, i) => `<rect x="42" y="8" width="16" height="22" rx="3" ${solid} transform="rotate(${i * 45} 50 50)"/>`).join('') + `<path fill-rule="evenodd" d="M50 20a30 30 0 1 0 .01 0zM50 38a12 12 0 1 1-.01 0z" fill="${INK}"/>`);
out('ui/lock.svg', sw('M33 46V32a17 17 0 0 1 34 0v14', 10) + `<path fill-rule="evenodd" ${solid} d="M30 44h40a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V52a8 8 0 0 1 8-8zM50 55a7 7 0 0 0-3.5 13v8h7v-8A7 7 0 0 0 50 55z"/>`);
out('ui/again.svg', sw('M80 50A30 30 0 1 1 69 27', 11) + `<polygon points="82,36 77,12 56,34" ${solid}/>`);
out('ui/album.svg', `<rect x="18" y="12" width="64" height="76" rx="8" fill="none" stroke="${INK}" stroke-width="7"/>` + sw('M33 12v76', 6) + `<polygon points="${star(58, 50, 17, 7.5)}" ${solid}/>`);
out('ui/star.svg', `<polygon points="50,6 63,36 95,38 70,59 78,92 50,74 22,92 30,59 5,38 37,36" fill="#FFC233" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);

// ---- app icon (background per amendment)
out('icons/icon.svg', `<rect x="0" y="0" width="100" height="100" rx="22" fill="#6B42DE"/><ellipse cx="50" cy="52" rx="38" ry="24" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/><circle cx="50" cy="52" r="15" fill="#FF9F1C" stroke="${INK}" stroke-width="3"/><polygon points="54,30 40,56 50,56 46,74 62,46 52,46" fill="#FFC233" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`);
