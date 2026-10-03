# Amendment A – Artwork and colour scheme from the user (2026-10-04)

Applies on top of `2026-10-03-blitzblick.md`. Implementers of Tasks 12, 13, 14 and 17 read the section for their task **in addition to** their brief; where they conflict, this amendment wins.

Source: artwork the user's son likes, cut out by `tools/extract-sprites.mjs` (uses `tools/sprite-lib.mjs`; palette sampled by `tools/sample-palette.mjs`) into `_lokal/extracted/` (git-ignored; sources in `_lokal/source/`).

## Palette (sampled from the mockups)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#EBEFFA` | page background (lavender) |
| `--surface` | `#FFFFFF` | cards, buttons |
| `--ink` | `#2D2A5D` | text, outlines |
| `--muted` | `#6E6E9A` | secondary text |
| `--line` | `#E0E8F7` | tracks, borders, empty slots |
| `--primary` | `#6B42DE` | primary buttons, active tabs |
| `--grad-a` / `--grad-b` | `#6BC2F7` → `#8C6AF5` | top bar gradient |
| `--accent` | `#348CE5` | focus ring, long-press ring |
| `--right` | `#2FAF6B` | correct answer (white text) |
| `--wrong` | `#EA6458` | wrong answer |
| `--star` | `#F7C86D` | stars, earned slots |
| `--tile-quantity` | `#EA6458` | menu tile Mengen (coral) |
| `--tile-digits` | `#348CE5` | menu tile Zahlen (blue) |
| `--tile-letters` | `#6B42DE` | menu tile Buchstaben (purple) |

Theme colour (`<meta name="theme-color">`, manifest `theme_color`): `#6B42DE`. Manifest `background_color`: `#EBEFFA`. App icon (`assets/icons/icon.svg`): background rect fill `#6B42DE` instead of `#2B59C3`.

## Task 12 – additional assets

Additional files to create (copy from `_lokal/extracted/`, downscaling with the existing `tools/sprite-lib.mjs` / headless-Chromium canvas approach — no new npm dependencies):

- `assets/avatars/<id>.png` – 12 avatars, **256×256** (downscaled from the 512 px cut-outs).
- `assets/decor/{star-big,badge-winner,bubble-yay,bubble-wow,confetti-1,confetti-2,confetti-3,confetti-4,confetti-5,confetti-6}.png` – longest side ≤ 320 px (do not upscale).
- `assets/mascot/robot-wave.png` – longest side ≤ 400 px.
- Commit `tools/extract-sprites.mjs`, `tools/sprite-lib.mjs`, `tools/sample-palette.mjs` with this task (dev tools, not precached). Add a short note to `CLAUDE.md` under „Start/Test“: `node tools/extract-sprites.mjs all` regenerates `_lokal/extracted/` from `_lokal/source/`.
- `assets/icons/icon.svg`: background `#6B42DE`.
- `tools/asset-sheet.html`: add groups `Deko` and `Maskottchen` for the new files.

Append to `tests/unit/assets.test.js`:

```js
const DECOR = ['star-big', 'badge-winner', 'bubble-yay', 'bubble-wow', 'confetti-1', 'confetti-2', 'confetti-3', 'confetti-4', 'confetti-5', 'confetti-6'];

function checkPng(path) {
  assert.ok(existsSync(file(path)), `${path} fehlt`);
  assert.equal(readFileSync(file(path)).subarray(1, 4).toString(), 'PNG', `${path}: kein PNG`);
}

test('decor sprites exist', () => { for (const d of DECOR) checkPng(`assets/decor/${d}.png`); });
test('mascot exists', () => checkPng('assets/mascot/robot-wave.png'));
test('raster assets stay small enough for offline caching', () => {
  const paths = [
    ...AVATARS.map((a) => `assets/avatars/${a}.png`),
    ...DECOR.map((d) => `assets/decor/${d}.png`),
    'assets/mascot/robot-wave.png',
  ];
  const total = paths.reduce((sum, p) => sum + statSync(file(p)).size, 0);
  assert.ok(total < 1_500_000, `Rastergrafiken zusammen ${total} Bytes (> 1,5 MB)`);
});
```

## Task 13 – colours, top bar, tiles, menu mascot

1. In `css/app.css` replace the whole `:root { … }` block with:

```css
:root {
  --bg: #EBEFFA; --surface: #FFFFFF; --ink: #2D2A5D; --muted: #6E6E9A; --line: #E0E8F7;
  --primary: #6B42DE; --primary-ink: #FFFFFF; --grad-a: #6BC2F7; --grad-b: #8C6AF5;
  --accent: #348CE5; --right: #2FAF6B; --wrong: #EA6458; --star: #F7C86D;
  --tile-quantity: #EA6458; --tile-digits: #348CE5; --tile-letters: #6B42DE;
  --radius: 20px; --shadow: 0 4px 0 rgba(45, 42, 93, .15);
  --font: 'Andika', ui-rounded, 'Segoe UI', system-ui, sans-serif;
}
```

2. Replace the `.topbar` rule with:

```css
.topbar {
  display: flex; align-items: center; gap: 12px; padding: 8px 12px; min-height: 72px;
  background: linear-gradient(90deg, var(--grad-a), var(--grad-b)); border-radius: 0 0 24px 24px; color: #fff;
}
```

3. Replace `.round-stars .slot { … }` background `var(--line)` with `rgba(255, 255, 255, .35)` and `.round-stars .slot.missed` background with `rgba(45, 42, 93, .25)`.

4. Replace the `.tile` rule and the three `.tile-*` rules with:

```css
.tile { aspect-ratio: 1.3; border-radius: 28px; box-shadow: var(--shadow); font-size: clamp(2.5rem, 9vw, 4.5rem); font-weight: 700; display: grid; place-items: center; transition: transform .1s; color: #fff; }
.tile-quantity { background: var(--tile-quantity); }
.tile-digits { background: var(--tile-digits); }
.tile-letters { background: var(--tile-letters); }
.tile-apples { background: rgba(255, 255, 255, .3); border-radius: 999px; padding: 6% 8%; }
```

5. Append:

```css
#app { position: relative; }
.mascot { position: absolute; right: 8px; bottom: 8px; width: min(26vw, 150px); pointer-events: none; z-index: 0; }
.menu, .menu-foot, .round-end > * { position: relative; z-index: 1; }
@media (max-width: 480px) { .mascot { width: 84px; } }
```

6. In `js/ui/menu.js`, append the mascot as the last child of `root.append(...)`:

```js
    h('img', { class: 'mascot', src: 'assets/mascot/robot-wave.png', alt: '' }),
```

7. `index.html`: `<meta name="theme-color" content="#6B42DE">`.

## Task 14 – celebratory round end

Replace `js/ui/round-end.js` from the plan with:

```js
import { h } from './dom.js';
import { uiIcon } from './widgets.js';
import { stickerUrl } from '../rewards.js';

const decor = (name, cls) => h('img', { class: cls, src: `assets/decor/${name}.png`, alt: '' });

function confetti() {
  return h('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: 18 }, (_, i) => {
    const piece = decor(`confetti-${(i % 6) + 1}`, 'confetti-piece');
    piece.style.left = `${(i * 37) % 100}%`;
    piece.style.animationDelay = `${(i % 6) * 0.15}s`;
    piece.style.animationDuration = `${2.2 + (i % 4) * 0.4}s`;
    return piece;
  }));
}

export function renderRoundEnd(root, ctx, { exerciseId, correct, reward }) {
  const prize = reward.sticker
    ? h('div', { class: 'sticker-reveal', 'data-testid': 'new-sticker', 'data-sticker': reward.sticker },
      h('img', { src: stickerUrl(reward.sticker), alt: '' }))
    : h('div', { class: 'bonus', 'data-testid': 'bonus-stars' }, `+${reward.bonusStars}`, uiIcon('star'));
  const unlocked = reward.newlyUnlockedPages.length
    ? h('div', { class: 'unlock', 'data-testid': 'page-unlocked' }, uiIcon('album'), '+', String(reward.newlyUnlockedPages.length))
    : null;
  const bubble = correct >= 8 ? decor('bubble-yay', 'end-bubble') : correct >= 5 ? decor('bubble-wow', 'end-bubble') : null;
  const btn = (icon, testid, label, onClick, extra = '') =>
    h('button', { class: `big-btn ${extra}`, 'data-testid': testid, 'aria-label': label, onClick }, uiIcon(icon));

  root.replaceChildren(
    h('main', { class: 'round-end', 'data-testid': 'round-end' },
      confetti(),
      h('div', { class: 'end-head' },
        bubble,
        h('div', { class: 'big-stars' }, decor('star-big', 'big-star'), h('span', {}, String(correct)))),
      prize,
      unlocked,
      h('div', { class: 'end-actions' },
        btn('again', 'play-again', 'Nochmal', () => ctx.go('round', { exerciseId })),
        btn('album', 'to-album', 'Album', () => ctx.go('album', { highlight: reward.sticker })),
        btn('check', 'round-done', 'Fertig', () => ctx.go('menu'), 'go'))),
    h('img', { class: 'mascot', src: 'assets/mascot/robot-wave.png', alt: '' }),
  );
  ctx.sounds.fanfare();
  const praise = correct >= 8 ? 'Super gemacht!' : correct >= 5 ? 'Gut gemacht!' : 'Toll geübt!';
  ctx.speech.speak(reward.sticker ? `${praise} Du hast einen neuen Sticker!` : `${praise} Du bekommst Extra-Sterne!`);
}
```

Append to `css/app.css`:

```css
.round-end { position: relative; overflow: hidden; }
.confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.confetti-piece { position: absolute; top: -48px; width: 28px; animation-name: fall; animation-timing-function: linear; animation-fill-mode: forwards; }
@keyframes fall { to { transform: translateY(110vh) rotate(540deg); } }
.end-head { display: flex; align-items: center; justify-content: center; gap: 12px; }
.end-bubble { width: clamp(90px, 22vw, 140px); animation: pop .4s .3s both; }
.big-stars { position: relative; display: grid; place-items: center; }
.big-stars .big-star { width: clamp(96px, 26vw, 150px); height: auto; grid-area: 1 / 1; }
.big-stars span { grid-area: 1 / 1; font-size: clamp(2rem, 7vw, 3rem); font-weight: 700; color: var(--ink); padding-top: 10%; }
```

The Task 14 e2e test stays unchanged (it only uses `data-testid` hooks).

## Task 17 – manifest

`manifest.webmanifest`: `"background_color": "#EBEFFA"`, `"theme_color": "#6B42DE"`. In `tools/render-icons.mjs` use body background `#6B42DE`.
