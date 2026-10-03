// Generates the hand-drawn SVG set (objects, ui icons, app icon, stickers) into assets/.
// Usage: node tools/gen-svgs.mjs   (output is committed; this script is the source of truth for redraws)
import fs from 'node:fs';

const ROOT = new URL('../assets/', import.meta.url);
const INK = '#2D2A5D';
const R = '#E5484D', O = '#FF9F1C', Y = '#FFC233', G = '#2EAD5B', B = '#2B59C3', V = '#7C5CFF', BR = '#8B5E3C', GR = '#9AA3B5', W = '#FFFFFF';
const TAN = '#F2C9A0', LG = '#8FD48B', PINK = '#F59DB4';
const OL = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
const NS = 'stroke="none"';
const n = (v) => +v.toFixed(1);
const p = (d, f, x = OL) => `<path d="${d}" fill="${f}" ${x}/>`;
const c = (cx, cy, r, f, x = OL) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${x}/>`;
const e = (cx, cy, rx, ry, f, rot = 0, x = OL) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${x}${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`;
const r = (x, y, w, h, f, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${OL}/>`;
const g = (pts, f) => `<polygon points="${pts}" fill="${f}" ${OL}/>`;
const ln = (d, w = 3) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const dot = (cx, cy, rr = 2.6) => `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${INK}"/>`;
const tube = (d, f, w) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 6}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${f}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const eye = (cx, cy, rr = 5) => c(cx, cy, rr, W) + dot(cx + 1, cy, rr * 0.45);
const shine = (cx, cy, rot = -25) => e(cx, cy, 5, 3, W, rot, NS);
const star = (cx, cy, ro, ri, k = 5) => Array.from({ length: k * 2 }, (_, i) => { const a = (-90 + i * 180 / k) * Math.PI / 180, rr = i % 2 ? ri : ro; return `${n(cx + rr * Math.cos(a))},${n(cy + rr * Math.sin(a))}`; }).join(' ');
const wedge = (cx, cy, rad, a0, a1) => { const pt = (a) => [n(cx + rad * Math.sin(a * Math.PI / 180)), n(cy - rad * Math.cos(a * Math.PI / 180))]; const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${cx} ${cy}L${x0} ${y0}A${rad} ${rad} 0 0 1 ${x1} ${y1}Z`; };
const svg = (b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${b}</svg>\n`;
const out = (path, b) => { const u = new URL(path, ROOT); fs.mkdirSync(new URL('.', u), { recursive: true }); fs.writeFileSync(u, svg(b)); };
const wheel = (cx, cy, rr = 9) => c(cx, cy, rr, GR) + c(cx, cy, rr * 0.4, W);
const smile = (cx, cy, w = 10) => ln(`M${cx - w / 2} ${cy}q${w / 2} ${w / 2} ${w} 0`);

// ---- objects
out('objects/apple.svg', `<path d="M50 30c-8-8-30-8-34 12-4 22 12 46 26 46 4 0 6-2 8-2s4 2 8 2c14 0 30-24 26-46-4-20-26-20-34-12z" fill="${R}" ${OL}/><path d="M50 30c0-8 2-14 6-18" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M56 20c6-8 16-8 20-4-4 6-12 8-20 4z" fill="${G}" ${OL}/>`);
out('objects/ball.svg', [0, 1, 2, 3, 4, 5].map((i) => p(wedge(50, 50, 40, i * 60, i * 60 + 60), [R, W, B][i % 3])).join('') + c(50, 50, 6, Y) + `<circle cx="50" cy="50" r="40" fill="none" ${OL}/>`);
out('objects/star.svg', g('50,6 63,36 95,38 70,59 78,92 50,74 22,92 30,59 5,38 37,36', Y));
out('objects/fish.svg', p('M12 50C24 30 52 26 70 44l18-14v40L70 56C52 74 24 70 12 50z', B) + p('M40 31C46 22 58 24 62 34', O) + ln('M46 40c4 6 4 14 0 20') + c(28, 46, 5, W) + dot(29, 46, 2));
out('objects/flower.svg', [0, 1, 2, 3, 4].map((i) => { const a = (i * 72 - 90) * Math.PI / 180; return c(n(50 + 24 * Math.cos(a)), n(50 + 24 * Math.sin(a)), 17, R); }).join('') + c(50, 50, 13, Y));
const carSvg = (body) => p('M24 52L36 30H64L78 52Z', body) + r(8, 50, 84, 24, body, 7) + p('M31 49L39 34H49V49Z', W) + p('M53 34H62L72 49H53Z', W) + e(88, 58, 4, 5, Y) + wheel(28, 74, 11) + wheel(72, 74, 11);
out('objects/car.svg', carSvg(R));

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

// ---- stickers
const S = {};
// animals
S['animals/lion'] = c(22, 28, 10, O) + c(78, 28, 10, O) + Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180; return c(n(50 + 32 * Math.cos(a)), n(54 + 32 * Math.sin(a)), 11, O); }).join('') + c(50, 54, 30, O) + c(50, 56, 25, Y) + dot(40, 50) + dot(60, 50) + g('44,58 56,58 50,65', BR) + ln('M50 65v4M43 70q7 6 14 0');
S['animals/elephant'] = c(20, 50, 20, GR) + c(80, 50, 20, GR) + tube('M50 56v24q0 10 10 10', GR, 16) + c(50, 44, 28, GR) + eye(39, 40) + eye(61, 40) + ln('M38 56q12 6 24 0', 2);
S['animals/giraffe'] = r(38, 44, 24, 52, Y, 4) + c(46, 66, 5, BR) + c(56, 80, 5, BR) + c(46, 90, 4, BR) + ln('M42 14v8M58 14v8', 6) + c(42, 12, 4, BR) + c(58, 12, 4, BR) + e(27, 30, 9, 5, Y, -20) + e(73, 30, 9, 5, Y, 20) + e(50, 34, 20, 18, Y) + e(50, 42, 13, 9, O) + dot(43, 41, 1.8) + dot(57, 41, 1.8) + dot(41, 28) + dot(59, 28);
S['animals/monkey'] = c(16, 50, 12, BR) + c(84, 50, 12, BR) + c(16, 50, 6, TAN, NS) + c(84, 50, 6, TAN, NS) + c(50, 48, 33, BR) + e(50, 58, 25, 22, TAN) + c(41, 48, 7, W) + c(59, 48, 7, W) + dot(42, 49, 2.8) + dot(58, 49, 2.8) + dot(46, 61, 1.8) + dot(54, 61, 1.8) + smile(50, 68, 16);
S['animals/penguin'] = e(20, 62, 7, 20, INK, 15) + e(80, 62, 7, 20, INK, -15) + e(38, 90, 11, 5, O) + e(62, 90, 11, 5, O) + e(50, 54, 29, 38, INK) + e(50, 64, 19, 26, W) + eye(41, 36, 6) + eye(59, 36, 6) + g('43,45 57,45 50,55', O);
S['animals/turtle'] = g('4,66 18,56 22,70', LG) + e(30, 74, 10, 6, LG) + e(68, 74, 10, 6, LG) + c(86, 58, 11, LG) + dot(89, 55) + p('M14 72a36 36 0 0 1 72 0z', G) + ln('M50 38v34M30 72l8-20h24l8 20M38 52l-6-12M62 52l6-12', 2.5);
S['animals/zebra'] = g('26,28 30,8 42,22', W) + g('74,28 70,8 58,22', W) + e(50, 52, 26, 34, W) + g('40,16 50,10 60,16 50,34', INK) + e(50, 76, 17, 13, GR) + dot(44, 76, 2) + dot(56, 76, 2) + ln('M26 46l9 3M26 58l9 2M74 46l-9 3M74 58l-9 2M40 36l5 8M60 36l-5 8', 4) + dot(40, 52) + dot(60, 52);
S['animals/hedgehog'] = g('12,72 14,50 22,54 22,34 32,42 36,24 46,34 52,18 60,34 70,24 72,42 82,34 80,54 90,52 90,74', BR) + e(66, 74, 10, 6, TAN) + e(40, 78, 10, 6, TAN) + e(28, 64, 20, 15, TAN) + dot(10, 66, 4.5) + dot(27, 58, 2.6);
// vehicles
S['vehicles/car'] = carSvg(B);
S['vehicles/bus'] = r(8, 24, 84, 50, Y, 9) + [14, 34, 54].map((x) => r(x, 32, 16, 16, W, 3)).join('') + r(74, 32, 12, 30, W, 3) + `<line x1="8" y1="60" x2="92" y2="60" stroke="${R}" stroke-width="5"/>` + wheel(28, 76, 10) + wheel(72, 76, 10);
S['vehicles/train'] = r(34, 22, 50, 8, INK, 2) + r(56, 28, 28, 44, B, 3) + r(10, 40, 50, 32, R, 5) + r(18, 22, 12, 20, GR, 2) + r(64, 34, 12, 14, W, 2) + wheel(26, 76, 9) + wheel(48, 76, 9) + wheel(72, 76, 9) + ln('M4 88h92', 4);
S['vehicles/plane'] = g('10,48 8,28 28,40 32,50', R) + g('42,48 60,48 76,80 60,80', B) + g('46,54 60,54 52,76', B) + e(48, 52, 40, 12, W) + [32, 44, 56, 68].map((x) => c(x, 50, 3.2, B)).join('') + g('84,44 96,52 84,58', R);
S['vehicles/ship'] = r(44, 24, 12, 18, Y, 2) + r(32, 40, 36, 20, W, 3) + c(42, 50, 4, B) + c(58, 50, 4, B) + p('M8 58H92L80 82H20Z', R) + ln('M6 90q8-7 16 0t16 0t16 0t16 0t16 0', 4);
S['vehicles/bike'] = tube('M24 66L40 38H66L48 66ZM66 38L76 66', R, 5) + ln('M34 33h14M60 31h14', 5) + [24, 76].map((x) => `<circle cx="${x}" cy="66" r="19" fill="none" stroke="${INK}" stroke-width="9"/><circle cx="${x}" cy="66" r="19" fill="none" stroke="${GR}" stroke-width="3.5"/>`).join('') + c(48, 66, 4, Y);
S['vehicles/tractor'] = r(70, 20, 6, 28, INK, 2) + r(48, 44, 44, 22, G, 5) + r(18, 22, 36, 42, R, 5) + r(24, 28, 22, 16, W, 3) + c(34, 68, 20, INK) + c(34, 68, 8, Y) + c(80, 74, 12, INK) + c(80, 74, 5, Y);
S['vehicles/firetruck'] = r(12, 28, 46, 7, W, 2) + ln('M22 28v7M32 28v7M42 28v7M52 28v7', 2.5) + p('M8 70V42H60V32H80L92 46V70Z', R) + p('M66 36H79L86 46H66Z', W) + r(66, 24, 12, 6, Y, 2) + wheel(28, 72, 11) + wheel(74, 72, 11);
// space
S['space/rocket'] = g('34,56 20,76 34,70', R) + g('66,56 80,76 66,70', R) + g('40,66 50,94 60,66', O) + g('45,66 50,80 55,66', Y) + p('M50 8C66 20 70 38 66 62H34C30 38 34 20 50 8Z', W) + p('M50 8C58 14 63 20 64 28H36C37 20 42 14 50 8Z', R) + c(50, 44, 9, B);
S['space/moon'] = p('M62 14A38 38 0 1 0 84 67A30 30 0 0 1 62 14Z', Y) + c(36, 42, 5, O) + c(30, 64, 4, O) + c(50, 78, 3.5, O);
S['space/sun'] = Array.from({ length: 8 }, (_, i) => { const a = i * 45 * Math.PI / 180, d = 0.22; const P = (rr, da) => `${n(50 + rr * Math.cos(a + da))},${n(50 + rr * Math.sin(a + da))}`; return g(`${P(30, -d)} ${P(46, 0)} ${P(30, d)}`, O); }).join('') + c(50, 50, 26, Y) + dot(41, 46) + dot(59, 46) + smile(50, 56, 14);
S['space/planet'] = c(50, 50, 28, V) + c(40, 40, 5, '#9B83FF', NS) + `<ellipse cx="50" cy="52" rx="46" ry="12" fill="none" stroke="${INK}" stroke-width="11" transform="rotate(-20 50 50)"/><ellipse cx="50" cy="52" rx="46" ry="12" fill="none" stroke="${O}" stroke-width="5" transform="rotate(-20 50 50)"/>`;
S['space/star'] = g(star(50, 54, 44, 21), Y) + dot(42, 52) + dot(58, 52) + smile(50, 60, 12);
S['space/astronaut'] = e(24, 72, 8, 6, W, -30) + e(76, 72, 8, 6, W, 30) + r(32, 62, 36, 28, W, 10) + c(50, 74, 5, R) + c(50, 38, 29, W) + e(50, 40, 20, 16, B) + shine(43, 35);
S['space/ufo'] = p('M30 52a20 20 0 0 1 40 0z', B) + e(50, 56, 42, 13, GR) + c(26, 58, 4, Y) + c(50, 63, 4, Y) + c(74, 58, 4, Y) + shine(42, 40);
S['space/comet'] = g('46,22 8,92 82,54', O) + c(66, 36, 20, Y) + c(60, 30, 5, W, NS);
// sea
S['sea/fish'] = `<path d="M14 50c14-22 44-26 62-8l14-12v40L76 58c-18 18-48 14-62-8z" fill="${O}" ${OL}/><path d="M44 36c4 8 4 20 0 28" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="46" r="5" fill="${W}" stroke="${INK}" stroke-width="3"/><circle cx="29" cy="46" r="2" fill="${INK}"/>`;
S['sea/octopus'] = ['M32 60q-4 18-16 22', 'M43 64q-1 18-6 24', 'M57 64q1 18 6 24', 'M68 60q4 18 16 22'].map((d) => tube(d, V, 9)).join('') + c(50, 40, 28, V) + eye(40, 38, 6) + eye(60, 38, 6) + smile(50, 52, 12);
S['sea/crab'] = ['M28 64L12 74', 'M30 70L22 86', 'M72 64L88 74', 'M70 70L78 86', 'M30 52L18 40', 'M70 52L82 40'].map((d) => tube(d, R, 5)).join('') + c(16, 32, 11, R) + c(84, 32, 11, R) + ln('M10 22l6 8M90 22l-6 8', 3) + tube('M42 44v-12M58 44v-12', R, 4) + e(50, 60, 30, 20, R) + eye(42, 28, 6) + eye(58, 28, 6) + smile(50, 66, 14);
S['sea/whale'] = p('M80 56C90 54 92 44 92 34C84 36 78 38 76 46Z', B) + p('M8 58C8 38 28 30 50 32C70 34 82 46 82 58C82 70 64 76 46 76C24 76 8 74 8 58Z', B) + p('M14 62C30 74 62 74 78 62C74 76 52 80 32 78C20 76 14 70 14 62Z', W) + dot(26, 50, 3) + ln('M30 30q-2-10-10-12M30 30q4-10 12-12', 3);
S['sea/starfish'] = g(star(50, 54, 44, 22), O) + [[50, 54], [50, 34], [32, 52], [68, 52], [40, 68], [60, 68]].map(([x, y]) => c(x, y, 2.6, Y, NS)).join('') + dot(44, 50, 2) + dot(56, 50, 2) + smile(50, 58, 8);
S['sea/seahorse'] = tube('M60 34C40 42 66 58 50 72C42 82 58 90 68 82', O, 14) + g('76,40 88,50 76,60', Y) + c(58, 26, 14, O) + tube('M50 28L32 34', O, 6) + dot(60, 22, 3) + ln('M46 44q8 4 12 14M46 56q8 4 8 14', 2.5) + g('56,10 62,4 66,12', Y);
S['sea/jellyfish'] = [30, 42, 54, 66].map((x) => ln(`M${x} 54q-6 10 0 18t0 18`, 4)).join('') + p('M16 56a34 34 0 0 1 68 0z', V) + shine(36, 38) + dot(40, 48) + dot(60, 48) + smile(50, 52, 8);
S['sea/shell'] = p('M50 86L12 52Q6 30 24 20Q50 6 76 20Q94 30 88 52Z', PINK) + ln('M50 86L24 24M50 86L38 14M50 86L50 12M50 86L62 14M50 86L76 24', 2.5) + r(38, 82, 24, 10, W, 4);
// dinos
S['dinos/trex'] = g('34,50 4,74 38,74', G) + e(48, 58, 26, 20, G) + e(50, 64, 14, 12, LG, 0, NS) + r(40, 70, 11, 20, G, 4) + r(58, 70, 11, 20, G, 4) + p('M52 38C52 22 66 16 80 18L92 24C98 30 94 42 88 46L66 46C58 46 52 44 52 38Z', G) + g('70,46 73,53 76,46', W) + g('80,46 83,53 86,46', W) + ln('M92 36h-26', 2.5) + eye(70, 28, 5) + tube('M62 58L74 62', G, 4);
S['dinos/stegosaurus'] = g('16,52 2,66 22,68', G) + g('22,50 28,28 38,44', O) + g('38,44 46,22 56,40', O) + g('56,40 64,26 72,44', O) + e(46, 60, 36, 20, G) + r(26, 72, 11, 18, G, 4) + r(58, 72, 11, 18, G, 4) + e(84, 62, 12, 9, G) + eye(86, 59, 3.5);
S['dinos/triceratops'] = c(68, 44, 22, R) + g('82,48 92,22 88,52', W) + g('10,60 4,72 20,70', O) + e(40, 64, 30, 20, O) + r(22, 74, 11, 16, O, 4) + r(50, 74, 11, 16, O, 4) + e(78, 62, 16, 13, O) + g('90,60 97,70 88,70', W) + dot(80, 56, 2.8);
S['dinos/brachiosaurus'] = tube('M14 70Q8 78 4 80', G, 8) + tube('M58 62Q72 54 70 30', G, 12) + e(40, 66, 28, 16, G) + c(30, 64, 4, LG, NS) + c(46, 62, 4, LG, NS) + r(22, 74, 10, 16, G, 4) + r(52, 74, 10, 16, G, 4) + e(76, 22, 11, 8, G) + dot(80, 20, 2.4);
S['dinos/pterodactyl'] = p('M44 44L4 22L16 46L6 62L30 54L44 62Z', O) + p('M56 44L96 22L84 46L94 62L70 54L56 62Z', O) + e(50, 54, 10, 18, BR) + e(50, 34, 8, 8, BR) + g('45,32 55,32 50,8', Y) + dot(46, 34, 2) + dot(54, 34, 2);
S['dinos/egg'] = p('M50 14C70 14 80 40 80 58C80 76 66 90 50 90C34 90 20 76 20 58C20 40 30 14 50 14Z', W) + c(38, 36, 5, G) + c(62, 34, 4, G) + c(66, 72, 5, G) + c(34, 72, 4, G) + ln('M21 56l10-8 8 10 11-12 11 12 8-10 11 8', 3.5);
S['dinos/volcano'] = c(46, 16, 7, GR) + c(58, 10, 5, GR) + p('M8 90L36 36H64L92 90Z', BR) + p('M36 36Q50 28 64 36Q50 42 36 36Z', O) + p('M43 38L47 60L54 46L56 70L62 38Z', O) + c(30, 24, 4, O) + c(70, 26, 3.5, Y);
S['dinos/footprint'] = e(26, 46, 8, 14, BR, -25) + e(50, 32, 8, 16, BR) + e(74, 46, 8, 14, BR, 25) + p('M32 64Q50 96 68 64Q50 48 32 64Z', BR);
for (const [k, b] of Object.entries(S)) out(`stickers/${k}.svg`, b);
console.log(Object.keys(S).length, 'stickers');
