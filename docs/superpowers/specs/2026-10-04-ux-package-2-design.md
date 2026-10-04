# UX package 2: menu, candy buttons, round-end reveal, parent controls (design, 2026-10-04)

Audience: children ~4–6 (menu, round end, welcome greeting) and their parents (parent area, profile form).
Source: `2026-10-04-ux-review.md`, package 2, items 5–8. Release target: 1.6.0.

## Goal
Make every screen look and feel like one toy: illustrated menu tiles instead of text on colour, one tactile button system everywhere, a round end that *shows* the sticker going into the album, and a parent area that no longer looks like browser defaults. No change to learning logic or stored data.

## Decisions (agreed with the user)
- Menu tiles: illustrations from `_lokal/source/menu-tiles.jpg`, **pastel** tile colours (option A in the mockup).
- Buttons: **flat face + soft highlight strip** (option A), thick bottom edge that sinks on press.
- Welcome on first start: **two steps** — robot greeting, then the existing profile form.
- The robot stays unnamed ("Hallo! Schön, dass du da bist.").
- Out of scope: the open small issues (plus stage shown for fixed duration, plus errors in digit confusion stats, 1.2.0 word issues).

## Approach
A CSS-only button system driven by custom properties, in a new file `css/candy.css` (linked from `index.html` after `app.css`, added to the precache). Existing classes (`.tile`, `.choice`, `.big-btn`, `.icon-btn`, `.album-btn`, `.primary-btn`, …) additionally get `candy` plus a level class. Test ids and JS logic stay as they are. Rejected: a JS `candyBtn()` component (touches every call site for no gain) and restyling each class individually (no shared system).

## 1 · Candy button system (`css/candy.css`)
Base `.candy` reads `--face`, `--edge`, `--depth`, `--r`:
- `background: var(--face); border-radius: var(--r); box-shadow: 0 var(--depth) 0 var(--edge);`
- Highlight: `::after` strip, `left/right 12%`, `top 4px`, height ~22 %, `rgba(255,255,255,.45)`, `pointer-events: none`. On white faces the strip is `#EBEFFA`-tinted and ~14 % high.
- `:active` (and `.pressed` for long-press feedback): `transform: translateY(var(--depth)); box-shadow: 0 0 0 var(--edge);` transition 80 ms.
- `:disabled`: keeps its edge, `opacity: .45`, no press motion.
- Elements that already use `::after` (gear ring) keep it; the highlight moves to `::before` for those (`.candy.gear`).

Levels (depth / radius):

| class | used by | depth | radius |
|---|---|---|---|
| `.candy-tile` | menu tiles | 8px | 28px |
| `.candy-answer` | `.choice` | 6px | 20px |
| `.candy-round` | `.big-btn`, `.icon-btn` | 6px | 50% |
| `.candy-pill` | `.album-btn`, `.primary-btn`, `.secondary-btn`, `.danger-btn`, welcome "Los geht's", profile cards | 5px | 999px (profile cards 28px) |
| `.candy-small` | parent tabs, chip remove, segment group frame, album tabs | 4px | 12px |

Colour variants set `--face`/`--edge`: default white (`#fff` / `#CBD3EE`), `.is-primary` (`#6B42DE` / `#4A28A8`, white ink), `.is-go` and answer `.right` (`#2FAF6B` / `#1F8350`, white ink), answer `.wrong` (`#FCE6E3` / `#F2B3A9`, wrong-red ink), `.is-danger` (white / `#EA6458`, red ink). The current `--shadow` on these elements is replaced by the edge; `--shadow` stays for non-button cards (stage, fieldsets, sticker cards).

## 2 · Menu
**Assets.** New mode `menu` in `tools/extract-sprites.mjs`: cut the 2×2 sheet `menu-tiles.jpg` (white background) into `_lokal/extracted/menu/{quantity,digits,letters,syllables}.png` — quadrant order top-left quantity (apple basket), top-right digits (blocks 1-2-3), bottom-left letters (ABC blocks), bottom-right syllables (clapping hands). Each quadrant is processed like the other sheets (flood the white background, group components so detached parts — the side "1" on the digit block, the clap lines and sparkles — stay with the main sprite, trim, square-pad). `tools/build-raster-assets.mjs` gets `...MENU.map((m) => ({ name: `menu/${m}`, square: 320 }))` → `assets/menu/*.webp`. Then `node tools/update-precache.mjs`.

**Tiles.** `TILE_CONTENT` in `js/ui/menu.js` is replaced by one `<img src="assets/menu/<id>.webp" alt="">` per tile. Pastel colours (replace the old `--tile-*` tokens, drop orange):

| exercise | face | edge |
|---|---|---|
| quantity | `#FFE1DC` | `#F2B3A9` |
| digits | `#DCEBFF` | `#A9C8F2` |
| letters | `#EAE0FF` | `#C4B2F2` |
| syllables | `#DDF4E4` | `#A8DDB9` |

The parent-area `.badge` (currently `--tile-letters`) switches to `--primary`.

**Grid.** `.menu` is always 2 columns and fills the free height (`grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr`), on phones too; tiles have no fixed aspect ratio, the image is `max-width/max-height: 78%` and centred. With 3 tiles the third spans both columns but stays one tile wide, centred (`.menu.count-3 .tile:last-child { grid-column: 1 / -1; justify-self: center; width: calc(50% - gap/2); }`); with 2 tiles a single row; with 1 tile it spans both columns. The `count-N` class is set in `render`.

**Robot greeting.** Below the top bar a `.greet` row: `robot-wave.webp` (~72px, 56px on phones) and a white speech bubble (tail pointing to the robot) with the same text that is spoken: "Hallo {Name}! Was möchtest du üben?". The name is inserted as text, never via innerHTML. The bottom-right `.mascot` is no longer rendered on the menu.

**Album button** stays in the footer (now `candy candy-pill`).

## 3 · Round end as a reveal
Applies to `js/ui/round-end.js` when `reward.sticker` is set.

1. Stage: centre card `.sticker-reveal` over a `.rays` element (`conic-gradient` of alternating `--star` and transparent wedges, radial mask fading out, rotating 360° in 8 s, linear, infinite).
2. Flip-in (0–700 ms): card animates from `rotateY(180deg) scale(.3)` to `rotateY(0) scale(1)` with a slight overshoot.
3. Hold until 1.8 s.
4. Fly (1.8–2.5 s): FLIP — measure card rect and the `to-album` button rect, then animate the card with `transform: translate(dx, dy) scale(s)` (s = button size / card size) and fade to `opacity: 0` in the last 20 %; rays fade out at the same time. The card's slot keeps its size (`visibility: hidden` after the flight), so nothing jumps.
5. Landing: the album button gets `.bump` (scale pop) and a small count badge shows the new total (`p.rewards.stickers.length` after the reward has been applied).

Implementation: Web Animations API (`el.animate`) chained with `finished` promises. `renderRoundEnd` returns a `stop()` that cancels running animations and pending timers; `js/ui/round.js` keeps it and calls it from the cleanup it already returns (today `() => { alive = false; }`), which `ctx.go` runs on navigation. Buttons are usable throughout; navigating mid-animation just runs the cleanup.

Bonus stars instead of a sticker: rays + "+N ★" pop in, no flight. No reward: the existing hint, no rays. `prefers-reduced-motion`: no rotation, flip or flight — the sticker card is shown statically, rays static, album count still updates.

Robot: `robot-cheer.webp` when `correct >= 5`, else `robot-wave.webp`.

## 4 · Parent area
Helpers in `js/ui/parents.js` (and a small `js/ui/controls.js` if parents.js would otherwise grow past ~350 lines):

- **Toggle** (`check` helper): keeps the native `<input type="checkbox">` with `role="switch"` and the same `data-testid`, visually hidden but focusable, followed by a styled track + knob (`--right` when on). Label text stays clickable. Disabled state as today.
- **Segmented control** (replaces `select` for short fixed lists): a `role="radiogroup"` of native radio inputs styled as connected segments in a `candy-small` frame; the selected segment gets `--primary`. Used for: Höchstens (3/4/5/6/8/10), Anordnung (Strukturiert/Zufällig/Gemischt — shortened labels; the long explanations move into a `.hint` line), Zahlenraum, Schreibweise (Groß/Klein/Beides), Aussprache (Laut/Name), Sprachausgabe (Aus/Wenig/Viel). The group keeps the old `data-testid`; each option gets `data-testid="<testid>-<value>"`. Segments wrap to two rows below 480px.
- **Stays a select:** voice choice (dynamic, long list) and the avatar select in the profile row — restyled only (`appearance: none`, chevron, same border/radius as inputs).
- **Duration slider** (replaces the three ms number inputs): `<input type="range" min="100" max="5000" step="50">` per value (Startwert/Feste Dauer, Kürzeste, Längste), with a live label in seconds, German decimal comma: `formatSeconds(450) === '0,45 s'`, `formatSeconds(1000) === '1 s'`, `formatSeconds(1500) === '1,5 s'`. Value is applied on `change` (release), the label updates on `input`. Storage stays in ms; same test ids `timing-start/min/max`. `formatSeconds` lives in `js/util.js` (pure, unit-tested).

## 5 · Welcome on first start
`js/ui/profiles.js` → when there are no profiles, `renderCreate` first shows a greeting step:
- Large `robot-wave.webp` (gentle bob animation, off under reduced motion), speech bubble "Hallo! Schön, dass du da bist.", one `candy candy-pill is-primary` button "Los geht's" (`data-testid="welcome-start"`). Speech says the bubble text (`extra: true`, as on the menu).
- "Los geht's" replaces the content with the existing profile form (restyled: candy buttons, avatar options as round candy buttons). Behaviour of the form is unchanged.

## Testing
- Unit: `formatSeconds` cases above; precache test (existing) covers the new CSS file and menu assets.
- e2e updates: replace `selectOption` on converted selects with clicks on `<testid>-<value>` segments; timing inputs move from `fill` to setting the range value (`locator.fill` works on range inputs in Playwright; otherwise `evaluate` + dispatch `change`); first-start flows in `start.spec.js` and `parents.spec.js` click `welcome-start` before filling the form.
- New e2e: menu shows 4 tile images in a 2-column grid and adapts with 3 enabled exercises; welcome step appears only without profiles; after a sticker round the album button count equals the stored sticker count; with `reducedMotion: 'reduce'` the sticker stays visible.
- Manual check on phone and tablet widths (portrait + landscape) for menu grid, round end and parent segments.

## Release
Version 1.6.0: CHANGELOG entry, `npm run precache`, local `--no-ff` merge of `feat/1.6` into `main`, tag `v1.6.0`, push (not `gh pr merge`). Commits with the noreply identity.
