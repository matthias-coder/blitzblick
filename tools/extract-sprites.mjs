// Usage: node tools/extract-sprites.mjs [avatars|chef|decor|mascot|sheets|sheet [prefix]|all]
// Reads _lokal/source/*.jpg, writes _lokal/extracted/**. Needs @playwright/test chromium (decode/encode only).
import fs from 'node:fs';
import path from 'node:path';
import { PAGES as LEVEL_PAGES, BONUS_PAGES, SECRET_PAGE } from '../js/rewards.js';
const PAGES = [...LEVEL_PAGES, ...BONUS_PAGES, SECRET_PAGE];
import { openBrowser, decode, encodePng, decodePng, floodBg, lightGrey, components, dilate, makeSprite, squarePad, trim } from './sprite-lib.mjs';

const SRC = '_lokal/source/', OUT = '_lokal/extracted/';
const F = {
  avatars: '6b42508e-0486-4169-b187-b47603a9aad8.jpg',
  chef: '771b1c9d-c1e0-4ae6-b325-321c4f166ec7.jpg',
  decor: '39658032-5b5c-46f8-8fb1-be2a5b815690.jpg',
  robot1: '157d5d0a-8431-43d4-a73f-4be959194115.jpg',
  robot2: '30d1605b-033e-468d-8e46-535700b3b21c.jpg',
};
const mode = process.argv[2] || 'all';
const { browser, page } = await openBrowser();
const save = (rel, buf) => { fs.mkdirSync(path.dirname(OUT + rel), { recursive: true }); fs.writeFileSync(OUT + rel, buf); console.log('wrote', rel); };
const bboxDist = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
const bb = (cs) => ({ x0: Math.min(...cs.map(c => c.x0)), y0: Math.min(...cs.map(c => c.y0)), x1: Math.max(...cs.map(c => c.x1)), y1: Math.max(...cs.map(c => c.y1)) });

// group components: mains (>= mainArea) + small ones attached to the nearest main within maxDist
function group(comps, mainArea, minSmall, maxDist, mains = comps.filter(c => c.area >= mainArea)) {
  const groups = mains.map(m => [m]);
  for (const c of comps) {
    if (mains.includes(c) || c.area < minSmall) continue;
    let best = -1, bd = 1e9;
    mains.forEach((m, i) => { const d = bboxDist(c, m); if (d < bd) { bd = d; best = i; } });
    if (bd <= maxDist) groups[best].push(c);
  }
  return groups;
}
async function exportAvatar(img, labels, cs, id) {
  const ids = new Set(cs.map(c => c.id));
  const fg = new Uint8Array(img.w * img.h);
  for (let i = 0; i < fg.length; i++) if (ids.has(labels[i])) fg[i] = 1;
  const sp = squarePad(makeSprite(img, fg, bb(cs)), 0.04);
  save(`avatars/${id}.png`, await encodePng(page, sp.data, sp.w, sp.h, 512, 512));
}

if (mode === 'avatars' || mode === 'all') {
  const img = await decode(page, SRC + F.avatars);
  const bg = floodBg(img, lightGrey(200, 38));
  const { labels, comps } = components(bg.map(v => 1 - v), img.w, img.h);
  const mains = comps.filter(c => c.area >= 5000);
  // sort into grid: rows 4/3/4 by centroid y, then x
  mains.sort((a, b) => a.cy - b.cy);
  const rows = [mains.slice(0, 4), mains.slice(4, 7), mains.slice(7, 11)].map(r => r.sort((a, b) => a.cx - b.cx));
  const ids = ['astronaut', 'monster', 'superhero', 'knight', 'dino', 'dragon', 'pony', 'taco', 'singer', 'cat', 'fairy'];
  const ordered = rows.flat();
  const groups = group(comps, 0, 6, 110, ordered);
  for (let i = 0; i < ids.length; i++) await exportAvatar(img, labels, groups[i], ids[i]);
}
if (mode === 'chef' || mode === 'all') {
  // chef touches the "LEVELED UP!" cloud: manual cut along the cloud's top outline (+3px so the dark outline stays as the chef's lower edge)
  const img = await decode(page, SRC + F.chef);
  const bg = floodBg(img, lightGrey(200, 38));
  const crop = [[150, 722], [185, 716], [230, 692], [310, 678], [380, 684], [425, 705]].map(([x, y]) => [x / 3 + 30, y / 3 + 620]);
  const cutY = (x) => {
    if (x >= crop[crop.length - 1][0]) return 620 + 620 / 3 - 0; // right of the cloud top: star area, cut at arm level
    if (x <= crop[0][0]) return crop[0][1] + (crop[0][0] - x) * 0.2;
    for (let i = 1; i < crop.length; i++) if (x <= crop[i][0]) { const [xa, ya] = crop[i - 1], [xb, yb] = crop[i]; return ya + (yb - ya) * (x - xa) / (xb - xa); }
  };
  const fg = new Uint8Array(img.w * img.h);
  for (let y = 625; y < 900; y++) for (let x = 35; x < 250; x++) if (!bg[y * img.w + x] && y < cutY(x)) fg[y * img.w + x] = 1;
  const { labels, comps } = components(fg, img.w, img.h);
  const main = comps.filter(c => c.area > 3000);
  console.log('chef comps', main.map(c => [c.area, c.x0, c.y0, c.x1, c.y1].join(',')));
  await exportAvatar(img, labels, main, 'chef');
}
if (mode === 'decor' || mode === 'all') {
  const img = await decode(page, SRC + F.decor);
  const { w, h } = img;
  const isBg = lightGrey(215, 30);
  const bg = floodBg(img, isBg);
  const { labels, comps } = components(bg.map(v => 1 - v), w, h);
  const inRect = (c, r) => c.x0 >= r[0] && c.y0 >= r[1] && c.x1 <= r[2] && c.y1 <= r[3];
  const outDecor = async (name, cs, extraBg = null, fgFilter = null, keepLargest = false) => {
    const ids = new Set(cs.map(c => c.id));
    const fg = new Uint8Array(w * h);
    for (let i = 0; i < fg.length; i++) if (ids.has(labels[i]) && !(extraBg && extraBg[i]) && !(fgFilter && !fgFilter(i % w, (i / w) | 0))) fg[i] = 1;
    if (keepLargest) { const r = components(fg, w, h); const m = r.comps.sort((a, b) => b.area - a.area)[0]; for (let i = 0; i < fg.length; i++) if (fg[i] && r.labels[i] !== m.id) fg[i] = 0; cs = [m]; }
    let sp = trim(makeSprite(img, fg, bb(cs)), 2);
    const sc = Math.min(1, 512 / Math.max(sp.w, sp.h));
    save('decor/' + name + '.png', await encodePng(page, sp.data, sp.w, sp.h, Math.round(sp.w * sc), Math.round(sp.h * sc)));
  };
  const rect = (r) => comps.filter(c => inRect(c, r));
  const big = (r) => rect(r).sort((a, b) => b.area - a.area)[0];
  // interior of frames is enclosed white: make it transparent too (flood from the frame centre)
  const hole = (cx, cy) => floodBg(img, isBg, [[cx, cy]]);
  await outDecor('frame-rect', rect([50, 350, 356, 612]), hole(205, 480));
  await outDecor('frame-round', rect([395, 352, 670, 628]), hole(532, 490));
  await outDecor('star-big', rect([705, 355, 975, 610]));
  await outDecor('ribbon', [big([675, 622, 980, 712])]);
  await outDecor('badge-winner', [big([505, 815, 640, 985])]);
  // YAY / WOW are one connected component: split at the thinnest row around the waist
  const bub = big([685, 730, 800, 882]);
  let cutRow = 0, minN = 1e9;
  for (let y = 795; y <= 820; y++) { let n = 0; for (let x = bub.x0; x <= bub.x1; x++) if (labels[y * w + x] === bub.id) n++; if (n < minN) { minN = n; cutRow = y; } }
  console.log('bubble cut row', cutRow, minN);
  await outDecor('bubble-yay', [bub], null, (x, y) => y < cutRow, true);
  await outDecor('bubble-wow', [bub], null, (x, y) => y >= cutRow, true);
  // confetti pieces picked by component id (shape variety: stars, circle, curl, chip)
  const CONF = [1, 17, 19, 49, 73, 108];
  for (let i = 0; i < CONF.length; i++) await outDecor('confetti-' + (i + 1), [comps.find(c => c.id === CONF[i])]);
}
if (mode === 'mascot' || mode === 'all') {
  // Robot sits on UI (lavender page / coloured cards). Its outline is dark navy and closed, so: crop a rectangle,
  // flood the *non-dark* area from the crop border (= everything outside the outline), keep the largest dark-outlined blob.
  const cropImg = (img, [x0, y0, x1, y1]) => {
    const W = x1 - x0, H = y1 - y0, d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let k = 0; k < 4; k++) d[(y * W + x) * 4 + k] = (x + x0 >= 624 || y + y0 >= 858) ? 255 : img.data[((y + y0) * img.w + x + x0) * 4 + k]; // paint tablet bezel white
    return { w: W, h: H, data: d };
  };
  const luma = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  const jobs = [
    ['robot-cheer', F.robot1, [455, 640, 626, 862]],
    ['robot-wave', F.robot2, [440, 612, 628, 862]],
  ];
  for (const [name, file, rc] of jobs) {
    const full = await decode(page, SRC + file);
    const img = cropImg(full, rc);
    const bg = floodBg(img, (r, g, b) => luma(r, g, b) > 100);
    const fg0 = bg.map(v => 1 - v);
    const { labels, comps } = components(fg0, img.w, img.h);
    const main = comps.sort((a, b) => b.area - a.area)[0];
    console.log(name, 'main', main.area, [main.x0, main.y0, main.x1, main.y1].join(','), 'others', comps.length - 1);
    const keep = comps.filter(c => c === main);
    const ids = new Set(keep.map(c => c.id));
    const fg = new Uint8Array(img.w * img.h);
    for (let i = 0; i < fg.length; i++) if (ids.has(labels[i])) fg[i] = 1;
    // fill enclosed holes (everything not reachable from outside is robot interior)
    const sp = squarePad(makeSprite(img, fg, bb(keep)), 0.04);
    save('mascot/' + name + '.png', await encodePng(page, sp.data, sp.w, sp.h, 512, 512));
  }
}
if (mode === 'sheets' || mode === 'all') {
  // Object/sticker sheets (v1.3): regular grids on white. Every component is assigned to the grid cell of its centroid,
  // so detached bits (steam, sparkles, spoon) stay with their motif. White die-cut borders and grey shadows flood away.
  const SHEETS = {
    a: ['216ca0e6-b029-4162-b05c-2c7e38c7e3f5.jpg', [3, 3, 3]],
    b: ['75c28c76-4f89-427a-958c-4621bc213d2c.jpg', [3, 3, 3], 150],
    c: ['776f5434-5b6c-40d5-b256-20882173e6f3.jpg', [3, 3, 3], 150],
    d: ['be71305d-4bc8-4a26-9e1d-560d2771ca0d.jpg', [4, 4, 4, 4], 150],
    e: ['Gemini_Generated_Image_3aoa333aoa333aoa.jpg', [3, 3, 3]],
    f: ['Gemini_Generated_Image_sonn79sonn79sonn.jpg', [3, 3, 4]],
    // v1.4: one 4×2 sheet per sticker page, items in row-major order
    animals: ['72424488-9b1b-4dd0-b93d-ce02ccdb0e61.jpg', [4, 4]],
    vehicles: ['ebdf37ed-39f2-487c-95ca-0d23baf29eb0.jpg', [4, 4]],
    space: ['8ce00dd9-0bad-45a8-962e-adaa14f22afc.jpg', [4, 4]],
    sea: ['7d1e5435-ed00-4053-b15e-f0b8ca445dcf.jpg', [4, 4]],
    dinos: ['ddbae619-b2e1-4aba-beb5-978a2076d572.jpg', [4, 4]],
    silly: ['64bc6059-c7be-48a4-949b-00fa6b14842c.jpg', [4, 4]],
    cooking: ['735e6d5b-7755-4db6-b5c2-12d7fdc7be27.jpg', [4, 4]],
    food: ['eca553f1-cfae-4a55-8410-98eb2a69a874.jpg', [4, 4]],
    veggies: ['1674c614-531b-4bd2-8735-03383eeeb955.jpg', [4, 4]],
    fruit: ['828c248c-dfe2-4639-a5f0-fc043ac2df1d.jpg', [4, 4]],
    // v1.5: TNT (row 0, col 2) is left out, so this page is cut explicitly below
    blockworld: ['kloetzchenwelt.jpg', [4, 4]],
    // v1.6: menu tiles, 2×2 on white
    menu: ['menu-tiles.jpg', [2, 2]],
    // v1.7: level celebration, one motif each on white (sparkles stay with it)
    trophy: ['robot-trophy.jpg', [1]],
    medal: ['medal.jpg', [1]],
    // v1.7.1: secret page (easter egg), 4×2 on beige
    mischief: ['sticker-quatsch-2-evil.jpg', [4, 4]],
    // v1.8: bonus pages; 3 rows on the sheet, row 3 repeats row 2
    garden: ['sticker-garten.jpg', [4, 4, 4]],
    construction: ['sticker-baustelle.jpg', [4, 4, 4]],
    bugs: ['sticker-krabbeltiere.jpg', [4, 4, 4]],
    // free layout on beige (1024×559), cut by boxes below
    everyday: ['sticker-alltagsfiguren.jpg', [1]],
  };
  const PAGE_SHEETS = Object.keys(SHEETS).filter((k) => k.length > 1 && !['blockworld', 'menu', 'trophy', 'medal', 'everyday'].includes(k));
  // [sheet, row, col, output path]
  const CUTS = [
    ['e', 1, 0, 'objects/apple'], ['e', 2, 0, 'objects/duck'], ['a', 0, 2, 'objects/ladybug'],
    ['a', 2, 0, 'objects/fish'], ['f', 0, 2, 'objects/car'], ['f', 2, 2, 'objects/balloon'],
    ['a', 0, 0, 'stickers/toys/train'], ['a', 0, 1, 'stickers/toys/hotairballoon'], ['e', 0, 0, 'stickers/toys/helicopter'],
    ['e', 0, 1, 'stickers/toys/rocket'], ['e', 0, 2, 'stickers/toys/sailboat'], ['e', 2, 1, 'stickers/toys/yoyo'],
    ['f', 2, 3, 'stickers/toys/blocks'], ['a', 1, 2, 'stickers/toys/teddy'],
    ['a', 2, 1, 'stickers/treats/icecream'], ['f', 0, 1, 'stickers/treats/cake'], ['c', 0, 1, 'stickers/treats/grapes'],
    ['c', 0, 2, 'stickers/treats/banana'], ['d', 3, 1, 'stickers/treats/cocoa'], ['e', 1, 1, 'stickers/treats/cheese'],
    ['b', 1, 2, 'stickers/treats/watermelon'], ['d', 0, 0, 'stickers/treats/strawberry'],
    ['b', 0, 0, 'stickers/kitchen/bread'], ['b', 0, 1, 'stickers/kitchen/spatula'], ['b', 0, 2, 'stickers/kitchen/mug'],
    ['b', 1, 1, 'stickers/kitchen/whisk'], ['b', 2, 0, 'stickers/kitchen/rollingpin'], ['b', 2, 1, 'stickers/kitchen/salad'],
    ['b', 2, 2, 'stickers/kitchen/pot'], ['e', 1, 2, 'stickers/kitchen/cereal'],
    ['d', 0, 1, 'stickers/magic/spellbook'], ['d', 0, 3, 'stickers/magic/crystals'], ['d', 1, 0, 'stickers/magic/wand'],
    ['d', 1, 1, 'stickers/magic/potion'], ['d', 1, 2, 'stickers/magic/broom'], ['d', 3, 3, 'stickers/magic/telescope'],
    ['d', 2, 2, 'stickers/magic/globe'], ['d', 2, 0, 'stickers/magic/camera'],
    ['a', 1, 1, 'stickers/room/pencils'], ['a', 2, 2, 'stickers/room/backpack'], ['e', 2, 2, 'stickers/room/book'],
    ['d', 1, 3, 'stickers/room/headphones'], ['d', 3, 2, 'stickers/room/sneakers'], ['d', 3, 0, 'stickers/room/flowers'],
    ['c', 1, 0, 'stickers/room/cat'], ['f', 1, 1, 'stickers/room/drawingbook'],
    ['blockworld', 0, 0, 'stickers/blockworld/pickaxe'], ['blockworld', 0, 1, 'stickers/blockworld/sword'],
    ['blockworld', 0, 3, 'stickers/blockworld/grassblock'], ['blockworld', 1, 0, 'stickers/blockworld/crystal'],
    ['blockworld', 1, 1, 'stickers/blockworld/chest'], ['blockworld', 1, 2, 'stickers/blockworld/slime'],
    ['blockworld', 1, 3, 'stickers/blockworld/sixtyseven'],
    ['trophy', 0, 0, 'mascot/robot-trophy'], ['medal', 0, 0, 'decor/medal'],
    ['menu', 0, 0, 'menu/quantity'], ['menu', 0, 1, 'menu/digits'], ['menu', 1, 0, 'menu/letters'], ['menu', 1, 1, 'menu/syllables'],
    // everyday: 8 of 11 motifs, picked by centroid box (D9 in the spec)
    ['everyday', 'box', [40, 30, 240, 220], 'stickers/everyday/icecowboy'],
    ['everyday', 'box', [540, 40, 720, 235], 'stickers/everyday/surfrock'],
    ['everyday', 'box', [800, 30, 980, 250], 'stickers/everyday/saxavocado'],
    ['everyday', 'box', [160, 225, 340, 350], 'stickers/everyday/cloudbot'],
    ['everyday', 'box', [315, 300, 445, 530], 'stickers/everyday/balletpencil'],
    ['everyday', 'box', [470, 300, 580, 530], 'stickers/everyday/mouse'],
    ['everyday', 'box', [600, 305, 710, 530], 'stickers/everyday/wrenchscientist'],
    ['everyday', 'box', [800, 310, 980, 520], 'stickers/everyday/pizzaking'],
    ...PAGE_SHEETS.flatMap((id) => PAGES.find((p) => p.id === id).stickers.map((s, i) => [id, Math.floor(i / 4), i % 4, `stickers/${id}/${s}`])),
  ];
  for (const [key, [file, rowCols, lightMin = 200]] of Object.entries(SHEETS)) {
    const cuts = CUTS.filter((c) => c[0] === key);
    if (!cuts.length) continue;
    if (!fs.existsSync(SRC + file) && (key === 'trophy' || key === 'medal')) { console.log('skipped (no source yet):', file); continue; }
    const img = await decode(page, SRC + file);
    const bg = floodBg(img, lightGrey(lightMin, 38)); // sheets with sticker shadows need a lower threshold
    const { labels, comps } = components(bg.map(v => 1 - v), img.w, img.h);
    const minArea = (img.w * img.h) / 40000; // drop JPEG speckles
    const cellOf = (c) => {
      const row = Math.min(rowCols.length - 1, Math.floor(c.cy / (img.h / rowCols.length)));
      return [row, Math.min(rowCols[row] - 1, Math.floor(c.cx / (img.w / rowCols[row])))];
    };
    for (const [, row, col, out] of cuts) {
      const inBox = row === 'box' && ((c) => c.cx >= col[0] && c.cx <= col[2] && c.cy >= col[1] && c.cy <= col[3]);
      const cs = comps.filter((c) => c.area >= minArea && (inBox
        ? inBox(c)
        // much wider than a cell = grid lines drawn by the generator, not a motif
        : c.x1 - c.x0 < 1.5 * img.w / rowCols[row] && cellOf(c).join() === `${row},${col}`));
      if (!cs.length) throw new Error(`${out}: nothing found in ${inBox ? 'box' : `cell ${row},${col}`}`);
      const ids = new Set(cs.map(c => c.id));
      const fg = new Uint8Array(img.w * img.h);
      for (let i = 0; i < fg.length; i++) if (ids.has(labels[i])) fg[i] = 1;
      const sp = squarePad(makeSprite(img, fg, bb(cs)), 0.04);
      console.log(out, 'parts', cs.length);
      save(out + '.png', await encodePng(page, sp.data, sp.w, sp.h, 512, 512));
    }
  }
}
if (mode === 'sheet' || mode === 'all') {
  const items = [];
  const STICKER_DIRS = fs.existsSync(OUT + 'stickers') ? fs.readdirSync(OUT + 'stickers').map((d) => 'stickers/' + d) : [];
  for (const d of ['avatars', 'decor', 'mascot', 'objects', 'menu', ...STICKER_DIRS]) {
    const dir = OUT + d; if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort()) items.push({ name: d + '/' + f.replace('.png', ''), b64: fs.readFileSync(path.join(dir, f)).toString('base64') });
  }
  const only = mode === 'sheet' ? process.argv[3] : null;
  const png = await page.evaluate(async ({ items, only }) => {
    const sel = only ? items.filter(i => i.name.startsWith(only)) : items;
    const T = 150, cols = 8, rows = Math.ceil(sel.length / cols) * 2;
    const c = document.createElement('canvas'); c.width = cols * T; c.height = rows * (T + 14);
    const x = c.getContext('2d');
    for (let k = 0; k < sel.length; k++) {
      const img = new Image(); img.src = 'data:image/png;base64,' + sel[k].b64; await img.decode();
      const col = k % cols, row = Math.floor(k / cols) * 2;
      for (let v = 0; v < 2; v++) {
        const ox = col * T, oy = (row + v) * (T + 14);
        if (v === 0) { for (let yy = 0; yy < T; yy += 10) for (let xx = 0; xx < T; xx += 10) { x.fillStyle = ((xx + yy) / 10) % 2 ? '#fff' : '#ccc'; x.fillRect(ox + xx, oy + yy, 10, 10); } }
        else { x.fillStyle = '#1F2350'; x.fillRect(ox, oy, T, T); }
        const sc = Math.min(T / img.width, T / img.height, 1.0);
        const w = img.width * sc, h = img.height * sc;
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, ox + (T - w) / 2, oy + (T - h) / 2, w, h);
        x.fillStyle = '#000'; x.fillRect(ox, oy + T, T, 14); x.fillStyle = '#fff'; x.font = '11px sans-serif'; x.fillText(sel[k].name, ox + 2, oy + T + 11);
      }
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { items, only });
  save(only ? 'contact-' + only.replace('/', '') + '.png' : 'contact-sheet.png', Buffer.from(png, 'base64'));
}
await browser.close();
