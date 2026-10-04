# Sticker Trade, Duplicates and Bonus Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stars become a currency: the child trades them in the album for random sticker packs priced by level (with duplicates, count badges and a bad-luck brake), gets free stars on a new level, and fills four new bonus pages.

**Architecture:** All rules live in pure functions in `js/rewards.js` (`openPack`, `isPageOpen`, `packTarget`) and `js/session.js` (level gift), unit-tested with `node:test`. `js/ui/album.js` gets the trade button, fifth tab and count badges; `js/ui/round-end.js` replaces the automatic sticker with a trade hint. New stickers are cut from `_lokal/source/` by `tools/extract-sprites.mjs` and downscaled to WebP by `tools/build-raster-assets.mjs`.

**Tech Stack:** Vanilla ES modules (no build), `node:test` unit tests, Playwright e2e, Playwright Chromium for sprite tools.

**Spec:** `docs/superpowers/specs/2026-10-04-sticker-trade-bonus-pages-design.md`

## Global Constraints

- Repo is public: commit only with `226609016+matthias-coder@users.noreply.github.com` (already the repo-local `user.email`); no personal data in commits.
- UI texts German, code/comments/commits English; test hooks via `data-testid`.
- Logic modules have no DOM access; only `js/storage.js` touches localStorage; user names never via innerHTML.
- After any change to `index.html`, `manifest.webmanifest`, `js/`, `css/`, `assets/`: run `npm run precache` (a unit test checks it).
- Prices: level 1 = 10, level 2 = 15, level 3 = 20, level 4 = 25, bonus page = 30 stars. Max 3 duplicates in a row per page.
- Stars: 1 per correct answer, unchanged. No half stars.
- Branch `feat/1.8.0` (exists, spec committed). Release: local `git merge --no-ff`, annotated tag `v1.8.0`, **ask the user before pushing**.
- Commands: `npm test` (unit), `npm run e2e` (Playwright), `npm run serve`.

## Review Focus

- Old profiles (stickers but no `counts`/`pity`, large star balances) must load and trade without errors; counts default to 1. → Task 3 sanitize test.
- Trading on the last missing sticker of an exercise's level pages opens the bonus page exactly once and adds 30 stars exactly once (not again on later packs). → Task 2 test "bonus gift only once".
- A level gift must not repeat when a child drops a level and climbs back (reached stays the max). → Task 3 test "no gift for an already reached level".
- Album with a balance below every price: buttons disabled, nothing changes on click. → Task 5 e2e.
- Round end when every page is complete: no trade hint, no progress bar, no crash in `packTarget`. → Task 2 test (`packTarget` returns `null`) + Task 6 code path.

---

### Task 1: Bonus pages data and assets

**Files:**
- Modify: `js/rewards.js` (page lists)
- Modify: `tools/extract-sprites.mjs` (sheets, box cuts)
- Modify: `tools/build-raster-assets.mjs:6,21` (include bonus pages)
- Modify: `js/exercises/quantity.js:15-23` (count pages)
- Create: `assets/stickers/{garden,construction,bugs,everyday}/*.webp` (generated)
- Test: `tests/unit/rewards.test.js`, `tests/unit/assets.test.js`, `tests/unit/quantity.test.js`

**Interfaces:**
- Produces: `BONUS_PAGES` (array of `{ id, title, exercise, bonus: true, stickers }`, menu order quantity, digits, letters, syllables), `ALL_PAGES = [...PAGES, ...BONUS_PAGES]`, `pageById(id) → page | null` (searches `ALL_PAGES` and `SECRET_PAGE`).

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/rewards.test.js` (extend the import with `BONUS_PAGES, ALL_PAGES, pageById`):

```js
test('one bonus page per exercise in menu order, eight unique stickers, no clash with other pages', () => {
  assert.deepEqual(BONUS_PAGES.map((p) => p.exercise), EXERCISE_ORDER);
  assert.deepEqual(BONUS_PAGES.map((p) => p.id), ['garden', 'construction', 'bugs', 'everyday']);
  for (const p of BONUS_PAGES) { assert.equal(p.bonus, true); assert.equal(new Set(p.stickers).size, 8); }
  const all = [...ALL_PAGES, SECRET_PAGE].flatMap((p) => p.stickers.map((s) => stickerId(p.id, s)));
  assert.equal(new Set(all).size, all.length);
  assert.equal(pageById('bugs').title, 'Krabbeltiere');
  assert.equal(pageById('mischief'), SECRET_PAGE);
  assert.equal(pageById('nope'), null);
});
```

In `tests/unit/assets.test.js` change line 4 import to also take `BONUS_PAGES` and line 26 to `for (const p of [...PAGES, ...BONUS_PAGES, SECRET_PAGE])`.

In `tests/unit/quantity.test.js` add:

```js
test('bonus pages garden, construction and bugs are counted, everyday is not', () => {
  assert.ok(quantity.OBJECTS.includes('bugs/ladybug'));
  assert.ok(quantity.OBJECTS.includes('construction/cone'));
  assert.ok(quantity.OBJECTS.includes('garden/sunflower'));
  assert.ok(!quantity.OBJECTS.includes('garden/tulips'));
  assert.ok(!quantity.OBJECTS.some((o) => o.startsWith('everyday/')));
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL (`BONUS_PAGES` is not exported).

- [ ] **Step 3: Add the page data**

In `js/rewards.js` after `SECRET_PAGE`:

```js
// v1.8: one bonus page per exercise, opened when the exercise's four level pages are complete (see isPageOpen)
export const BONUS_PAGES = [
  { id: 'garden', title: 'Garten', exercise: 'quantity', bonus: true, stickers: ['sunflower', 'wateringcan', 'tulips', 'snail', 'butterfly', 'gnome', 'bee', 'flowerpot'] },
  { id: 'construction', title: 'Baustelle', exercise: 'digits', bonus: true, stickers: ['excavator', 'crane', 'dumptruck', 'hardhat', 'cone', 'mixer', 'wheelbarrow', 'hammer'] },
  { id: 'bugs', title: 'Krabbeltiere', exercise: 'letters', bonus: true, stickers: ['ladybug', 'dragonfly', 'caterpillar', 'beetle', 'grasshopper', 'spider', 'firefly', 'worm'] },
  { id: 'everyday', title: 'Alltagsfiguren', exercise: 'syllables', bonus: true, stickers: ['icecowboy', 'surfrock', 'saxavocado', 'cloudbot', 'balletpencil', 'mouse', 'wrenchscientist', 'pizzaking'] },
];
export const ALL_PAGES = [...PAGES, ...BONUS_PAGES];
export const pageById = (id) => (id === SECRET_PAGE.id ? SECRET_PAGE : ALL_PAGES.find((p) => p.id === id) ?? null);
```

In `js/exercises/quantity.js`: import `ALL_PAGES` instead of `PAGES`, append `'garden', 'construction', 'bugs'` to `COUNT_PAGES`, add `'garden/tulips'` to `NOT_COUNTABLE`, and look pages up with `ALL_PAGES.find(...)`.

In `tools/build-raster-assets.mjs`: import `BONUS_PAGES` and use `[...PAGES, ...BONUS_PAGES, SECRET_PAGE]` on line 21.

- [ ] **Step 4: Extend the sprite extractor**

In `tools/extract-sprites.mjs`:
1. Line 5–6: `import { PAGES as LEVEL_PAGES, BONUS_PAGES, SECRET_PAGE } ...; const PAGES = [...LEVEL_PAGES, ...BONUS_PAGES, SECRET_PAGE];`
2. Add to `SHEETS` (rows 1–2 are used; row 3 repeats row 2 and is ignored because the generic page cuts only take `Math.floor(i / 4)` = rows 0–1):

```js
    // v1.8: bonus pages; 3 rows on the sheet, row 3 repeats row 2
    garden: ['sticker-garten.jpg', [4, 4, 4]],
    construction: ['sticker-baustelle.jpg', [4, 4, 4]],
    bugs: ['sticker-krabbeltiere.jpg', [4, 4, 4]],
    // free layout on beige (1024×559), cut by boxes below
    everyday: ['sticker-alltagsfiguren.jpg', [1]],
```

3. Exclude `everyday` from `PAGE_SHEETS` (add it to the list next to `'blockworld'`).
4. Add box cuts: a cut may be `[sheet, 'box', [x0, y0, x1, y1], out]`, which takes every component (area ≥ minArea) whose centroid lies inside the box. Add these entries to `CUTS`:

```js
    // everyday: 8 of 11 motifs, picked by centroid box (D9 in the spec)
    ['everyday', 'box', [40, 30, 240, 220], 'stickers/everyday/icecowboy'],
    ['everyday', 'box', [540, 40, 720, 235], 'stickers/everyday/surfrock'],
    ['everyday', 'box', [800, 30, 980, 250], 'stickers/everyday/saxavocado'],
    ['everyday', 'box', [160, 225, 340, 350], 'stickers/everyday/cloudbot'],
    ['everyday', 'box', [315, 300, 445, 530], 'stickers/everyday/balletpencil'],
    ['everyday', 'box', [470, 300, 580, 530], 'stickers/everyday/mouse'],
    ['everyday', 'box', [600, 305, 710, 530], 'stickers/everyday/wrenchscientist'],
    ['everyday', 'box', [800, 310, 980, 520], 'stickers/everyday/pizzaking'],
```

and in the cut loop branch on it before the grid filter:

```js
    for (const [, row, col, out] of cuts) {
      const inBox = row === 'box' && ((c) => c.cx >= col[0] && c.cx <= col[2] && c.cy >= col[1] && c.cy <= col[3]);
      const cs = comps.filter((c) => c.area >= minArea && (inBox
        ? inBox(c)
        // much wider than a cell = grid lines drawn by the generator, not a motif
        : c.x1 - c.x0 < 1.5 * img.w / rowCols[row] && cellOf(c).join() === `${row},${col}`));
      if (!cs.length) throw new Error(`${out}: nothing found in ${inBox ? 'box' : `cell ${row},${col}`}`);
```

The beige sheet with white die-cut borders already works for `mischief` with the default `lightMin`; if the everyday stickers lose their white border or merge with the background, pass `150` as third `SHEETS` value (as sheets `b`–`d` do).

- [ ] **Step 5: Run the extractor and build assets**

```bash
node tools/extract-sprites.mjs sheets
node tools/extract-sprites.mjs sheet stickers/garden
node tools/extract-sprites.mjs sheet stickers/construction
node tools/extract-sprites.mjs sheet stickers/bugs
node tools/extract-sprites.mjs sheet stickers/everyday
```

Look at each `_lokal/extracted/contact-stickers*.png`: every sprite shows exactly its motif, nothing cut off, no neighbour parts (for `everyday`: no socket next to the pencil, no small mouse next to the pizza). Adjust boxes or `lightMin` and repeat until clean. Then:

```bash
node tools/build-raster-assets.mjs
npm run precache
```

- [ ] **Step 6: User review gate**

Show the user the four contact sheets and wait for approval before continuing. Re-cut on request.

- [ ] **Step 7: Run tests, verify they pass**

Run: `npm test`
Expected: PASS (all, including assets and precache tests).

- [ ] **Step 8: Commit**

```bash
git add js/rewards.js js/exercises/quantity.js tools/extract-sprites.mjs tools/build-raster-assets.mjs assets/stickers sw.js tests/unit
git commit -m "feat: bonus sticker pages garden, construction, bugs, everyday"
```

(`npm run precache` rewrites the precache list; add whatever file it changed if it is not `sw.js`; check with `git status`.)

---

### Task 2: Page opening rules and pack trade (pure logic)

**Files:**
- Modify: `js/rewards.js`
- Test: `tests/unit/rewards.test.js`

**Interfaces:**
- Consumes: `PAGES`, `BONUS_PAGES`, `ALL_PAGES`, `pageById`, `SECRET_PAGE`, `stickerId`, existing private `pick(rng, arr)` and `idsOf(page)`.
- Produces:
  - `isPageOpen(rewards, page) → boolean` (**signature change**: was `(reached, page)`)
  - `isPageComplete(rewards, page) → boolean`
  - `isPageVisible(rewards, page) → boolean` (unchanged signature)
  - `PACK_PRICE = [10, 15, 20, 25]`, `BONUS_PACK_PRICE = 30`, `MAX_PITY = 3`, `packPrice(page) → number`
  - `countOf(rewards, stickerId) → number` (0 if not owned, else `counts[id] ?? 1`)
  - `canTrade(rewards, page) → boolean` (open and not complete; never for `SECRET_PAGE`)
  - `openPack(rewards, pageId, rng) → null | { rewards, sticker, duplicate, count, unlockedBonus }`
  - `packTarget(rewards, exercise, level) → null | { page, price, affordable }`

- [ ] **Step 1: Write failing tests**

Replace the test `pages open with the level reached; ...` in `tests/unit/rewards.test.js` and add the new tests (extend the import with `isPageComplete, PACK_PRICE, BONUS_PACK_PRICE, packPrice, countOf, canTrade, openPack, packTarget`):

```js
const withPages = (rewards, pageIds) => ({ ...rewards, stickers: [...rewards.stickers, ...pageIds.flatMap(ids)] });
const levelIds = (exercise) => PAGES.filter((p) => p.exercise === exercise).map((p) => p.id);
const rich = (stars = 1000) => ({ ...fresh(), stars });
const always = (v) => () => v; // fake rng

test('pages open with the level reached; pages with collected stickers stay visible', () => {
  const fruit = PAGES.find((p) => p.id === 'fruit');
  const food = PAGES.find((p) => p.id === 'food');
  assert.equal(isPageOpen(fresh(), fruit), true);
  assert.equal(isPageOpen(fresh(), food), false);
  assert.equal(isPageOpen({ ...fresh(), reached: { ...none(), quantity: 3 } }, food), true);
  assert.equal(isPageVisible({ ...fresh(), stickers: ['food/pizza'] }, food), true);
  assert.equal(isPageVisible(fresh(), food), false);
});

test('a bonus page opens only when all four level pages of its exercise are complete', () => {
  const garden = pageById('garden');
  const allButOne = withPages(fresh(), levelIds('quantity'));
  allButOne.stickers = allButOne.stickers.filter((id) => id !== 'food/pizza');
  assert.equal(isPageOpen(allButOne, garden), false);
  assert.equal(isPageOpen(withPages(fresh(), levelIds('quantity')), garden), true);
  assert.equal(isPageOpen(withPages(fresh(), levelIds('digits')), garden), false);
});

test('prices grow with the level, bonus pages cost 30', () => {
  assert.deepEqual(PAGES.filter((p) => p.exercise === 'letters').map(packPrice), [10, 15, 20, 25]);
  assert.equal(packPrice(pageById('bugs')), BONUS_PACK_PRICE);
  assert.equal(BONUS_PACK_PRICE, 30);
});

test('openPack refuses locked, complete, secret or unaffordable pages', () => {
  assert.equal(openPack(rich(), 'food', always(0)), null); // level 4 not reached
  assert.equal(openPack(withPages(rich(), ['fruit']), 'fruit', always(0)), null); // complete
  assert.equal(openPack(rich(), 'mischief', always(0)), null);
  assert.equal(openPack(rich(), 'nope', always(0)), null);
  assert.equal(openPack({ ...fresh(), stars: 9 }, 'fruit', always(0)), null);
  assert.ok(openPack({ ...fresh(), stars: 10 }, 'fruit', always(0)));
});

test('a fresh page always gives a new sticker and costs the price', () => {
  const r = openPack(rich(100), 'fruit', always(0.99));
  assert.equal(r.duplicate, false);
  assert.ok(r.sticker.startsWith('fruit/'));
  assert.equal(r.count, 1);
  assert.equal(r.rewards.stars, 90);
  assert.deepEqual(r.rewards.stickers, [r.sticker]);
  assert.equal(r.rewards.pity.fruit, 0);
});

test('a duplicate raises the count and the pity; three in a row force a new sticker', () => {
  // 7 of 8 owned: natural chance for new = 1/8
  const start = { ...rich(), stickers: ids('fruit').slice(0, 7) };
  let r = openPack(start, 'fruit', always(0.5));
  assert.equal(r.duplicate, true);
  assert.equal(r.count, 2);
  assert.equal(countOf(r.rewards, r.sticker), 2);
  assert.equal(r.rewards.pity.fruit, 1);
  r = openPack(r.rewards, 'fruit', always(0.5)); // 1/8 + 1/3 < 0.5 → duplicate
  assert.equal(r.rewards.pity.fruit, 2);
  r = openPack(r.rewards, 'fruit', always(0.5)); // 1/8 + 2/3 > 0.5 → new
  assert.equal(r.duplicate, false);
  assert.equal(r.sticker, ids('fruit')[7]);
  assert.equal(r.rewards.pity.fruit, 0);
  const forced = openPack({ ...start, pity: { fruit: 3 } }, 'fruit', always(0.999));
  assert.equal(forced.duplicate, false);
});

test('completing the last level page of an exercise opens its bonus page and gives 30 stars once', () => {
  const almost = withPages(rich(25), levelIds('digits'));
  almost.stickers = almost.stickers.filter((id) => id !== 'blockworld/slime');
  almost.reached = { ...none(), digits: 3 };
  const r = openPack(almost, 'blockworld', always(0));
  assert.equal(r.sticker, 'blockworld/slime');
  assert.equal(r.unlockedBonus, 'construction');
  assert.equal(r.rewards.stars, 25 - 25 + 30);
  const again = openPack(r.rewards, 'construction', always(0));
  assert.equal(again.unlockedBonus, null);
  assert.equal(again.rewards.stars, 30 - 30);
});

test('countOf: 0 when not owned, 1 without a stored count', () => {
  assert.equal(countOf(fresh(), 'fruit/pear'), 0);
  assert.equal(countOf({ ...fresh(), stickers: ['fruit/pear'] }, 'fruit/pear'), 1);
  assert.equal(countOf({ ...fresh(), stickers: ['fruit/pear'], counts: { 'fruit/pear': 4 } }, 'fruit/pear'), 4);
});

test('packTarget prefers the page just played, then any affordable one, else the cheapest; null when all is full', () => {
  const r = { ...rich(20), reached: { ...none(), letters: 2 } };
  assert.equal(packTarget(r, 'letters', 2).page.id, 'dinos');
  assert.equal(packTarget({ ...r, stars: 12 }, 'letters', 2).page.id, 'animals'); // same exercise, affordable
  assert.equal(packTarget({ ...r, stars: 12 }, 'digits', 2).page.id, 'toys');
  const poor = packTarget({ ...r, stars: 3 }, 'letters', 2);
  assert.equal(poor.affordable, false);
  assert.equal(poor.price, 10);
  const full = { ...rich(), reached: { quantity: 3, digits: 3, letters: 3, syllables: 3 }, stickers: ALL_PAGES.flatMap(idsOfPage) };
  assert.equal(packTarget(full, 'letters', 2), null);
  assert.equal(canTrade(full, pageById('fruit')), false);
});

test('openPack does not mutate its input', () => {
  const before = rich(50);
  openPack(before, 'fruit', always(0));
  assert.deepEqual(before, rich(50));
});
```

with the helper `const idsOfPage = (p) => p.stickers.map((s) => stickerId(p.id, s));` next to `ids`.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL (`openPack` is not exported; old `isPageOpen(none(), …)` signature).

- [ ] **Step 3: Implement**

In `js/rewards.js` replace `isPageOpen`/`isPageVisible` and add the trade functions:

```js
export const PACK_PRICE = [10, 15, 20, 25];
export const BONUS_PACK_PRICE = 30;
export const MAX_PITY = 3; // at most this many duplicates in a row per page
export const packPrice = (page) => (page.bonus ? BONUS_PACK_PRICE : PACK_PRICE[page.level]);

export const isPageComplete = (rewards, page) => idsOf(page).every((id) => rewards.stickers.includes(id));
// level page: opens with the level reached; bonus page: opens when the exercise's four level pages are complete
export function isPageOpen(rewards, page) {
  if (page.bonus) return PAGES.filter((p) => p.exercise === page.exercise).every((p) => isPageComplete(rewards, p));
  return (rewards.reached?.[page.exercise] ?? 0) >= page.level;
}
// a page with collected stickers stays visible even if its level was not reached (e.g. stickers from before 1.7)
export const isPageVisible = (rewards, page) => isPageOpen(rewards, page) || idsOf(page).some((id) => rewards.stickers.includes(id));
export const countOf = (rewards, id) => (rewards.stickers.includes(id) ? rewards.counts?.[id] ?? 1 : 0);
export const canTrade = (rewards, page) => page !== SECRET_PAGE && isPageOpen(rewards, page) && !isPageComplete(rewards, page);

// one random sticker of the page, duplicates included; every duplicate in a row raises the chance for a new one by 1/MAX_PITY
export function openPack(rewards, pageId, rng) {
  const page = pageById(pageId);
  if (!page || !canTrade(rewards, page) || rewards.stars < packPrice(page)) return null;
  const all = idsOf(page);
  const missing = all.filter((id) => !rewards.stickers.includes(id));
  const have = all.filter((id) => rewards.stickers.includes(id));
  const pity = rewards.pity?.[pageId] ?? 0;
  const isNew = rng() < Math.min(1, missing.length / all.length + pity / MAX_PITY);
  const sticker = pick(rng, isNew ? missing : have);
  const count = isNew ? 1 : countOf(rewards, sticker) + 1;
  let next = {
    ...rewards,
    stars: rewards.stars - packPrice(page),
    stickers: isNew ? [...rewards.stickers, sticker] : [...rewards.stickers],
    counts: { ...rewards.counts, [sticker]: count },
    pity: { ...rewards.pity, [pageId]: isNew ? 0 : pity + 1 },
  };
  const bonus = BONUS_PAGES.find((b) => !isPageOpen(rewards, b) && isPageOpen(next, b)) ?? null;
  if (bonus) next = { ...next, stars: next.stars + BONUS_PACK_PRICE };
  return { rewards: next, sticker, duplicate: !isNew, count, unlockedBonus: bonus?.id ?? null };
}

// where the round end points the child: the page just played if affordable, else another page of that exercise,
// else any affordable page, else the cheapest tradable page (for the progress bar); null when everything is complete
export function packTarget(rewards, exercise, level) {
  const pages = ALL_PAGES.filter((p) => canTrade(rewards, p));
  if (!pages.length) return null;
  const affordable = pages.filter((p) => packPrice(p) <= rewards.stars);
  const page = affordable.find((p) => p.exercise === exercise && !p.bonus && p.level === level)
    ?? affordable.find((p) => p.exercise === exercise)
    ?? affordable[0]
    ?? pages.reduce((a, b) => (packPrice(b) < packPrice(a) ? b : a));
  return { page, price: packPrice(page), affordable: affordable.length > 0 };
}
```

`pageById`, `BONUS_PAGES` and `ALL_PAGES` must be declared above these functions (they are, from Task 1). Update the remaining internal caller in `applyRoundRewards` from `isPageOpen(reached, p)` to `isPageOpen({ ...rewards, reached }, p)` and `isPageOpen(rewards.reached, p)` to `isPageOpen(rewards, p)` (that function is rewritten in Task 3; this keeps the suite green in between). Update the old tests that call `isPageOpen(reached, …)` (around old lines 62–63) the same way.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/rewards.js tests/unit/rewards.test.js
git commit -m "feat: sticker packs priced by level with duplicates and bad-luck brake"
```

---

### Task 3: Round rewards without automatic sticker, level gift, profile sanitizing

**Files:**
- Modify: `js/rewards.js` (`applyRoundRewards`, remove `STICKER_MIN_CORRECT`, `BONUS_STARS`)
- Modify: `js/session.js:68-89` (`finishRound`)
- Modify: `js/profiles.js:152-170` (`normalizeProfile`)
- Test: `tests/unit/rewards.test.js`, `tests/unit/session.test.js`, `tests/unit/profiles.test.js`

**Interfaces:**
- Consumes: `isPageOpen(rewards, page)`, `PACK_PRICE`, `ALL_PAGES`, `MAX_PITY` from Task 2.
- Produces:
  - `applyRoundRewards(rewards, correct, rng, { reached, today }) → { rewards, sticker, secret, newlyUnlockedPages }` (no `earned`, no `bonusStars`; `sticker` is only ever a secret sticker)
  - `finishRound(...)` result `reward` gains `gift: number` (0 or the pack price of the new level)
  - normalized profiles always have `rewards.counts` (object, only ids in `stickers`, integers ≥ 2) and `rewards.pity` (object, known page ids, integers 1–3)

- [ ] **Step 1: Write failing tests**

In `tests/unit/rewards.test.js` delete the tests `a round adds one star per correct answer and a sticker from 4 correct…`, `below 4 correct…`, `full page: another open page…`, `no duplicates until the page is complete`, and replace `a level-up opens the next page and reports it` with:

```js
test('a round adds one star per correct answer and no sticker', () => {
  const r = play(fresh(), 5, 1);
  assert.equal(r.rewards.stars, 5);
  assert.equal(r.sticker, null);
  assert.deepEqual(r.rewards.stickers, []);
});

test('a level-up opens the next page and reports it', () => {
  const r = play(fresh(), 5, 4, 'digits', 0, { ...none(), digits: 1 });
  assert.deepEqual(r.newlyUnlockedPages, ['vehicles']);
  assert.equal(r.rewards.reached.digits, 1);
});
```

Remove `STICKER_MIN_CORRECT` from the import. The secret-page tests stay; adjust any assertion on `earned`/`bonusStars` away.

In `tests/unit/session.test.js` add (reuse that file's existing helpers for building a profile and a finished round; the round must end with `levelUp` true, i.e. a mastered level as in the existing level-up test there):

```js
test('the first time a level is reached in a round the child gets its pack price as stars', () => {
  // build `profile` and a mastered `round` on quantity level 0 exactly like the existing level-up test in this file
  const { profile: after, reward } = finishRound(profile, round, mulberry32(1));
  assert.equal(reward.levelUp.to, 1);
  assert.equal(reward.gift, 15);
  assert.equal(after.rewards.stars, profile.rewards.stars + correctCount + 15);
});

test('no gift for an already reached level', () => {
  const p = { ...profile, rewards: { ...profile.rewards, reached: { ...profile.rewards.reached, quantity: 1 } } };
  const { reward } = finishRound(p, round, mulberry32(1));
  assert.equal(reward.levelUp.to, 1);
  assert.equal(reward.gift, 0);
});
```

(`correctCount` = `round.results.filter((r) => r.correct).length`.)

In `tests/unit/profiles.test.js` add:

```js
test('rewards counts and pity are sanitized; old profiles get empty ones', () => {
  const old = normalizeProfile({ name: 'A', rewards: { stars: 300, stickers: ['fruit/pear'] } });
  assert.deepEqual(old.rewards.counts, {});
  assert.deepEqual(old.rewards.pity, {});
  assert.equal(old.rewards.stars, 300);
  const p = normalizeProfile({ name: 'A', rewards: { stars: 0, stickers: ['fruit/pear', 'sea/fish'],
    counts: { 'fruit/pear': 3, 'sea/fish': 1, 'dinos/egg': 5, 'sea/x': 'two' },
    pity: { fruit: 2, sea: 9, nope: 1, dinos: -1 } } });
  assert.deepEqual(p.rewards.counts, { 'fruit/pear': 3 });
  assert.deepEqual(p.rewards.pity, { fruit: 2 });
});
```

(If `normalizeProfile` needs more fields than `name`, copy the minimal raw profile used by the neighbouring tests.)

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL (`gift` undefined, sticker still awarded, counts missing).

- [ ] **Step 3: Implement**

`js/rewards.js`: delete `BONUS_STARS`, `STICKER_MIN_CORRECT` and replace `applyRoundRewards`:

```js
// stars for every correct answer; stickers are traded in the album (openPack).
// No correct answer at all: a missing secret sticker, at most one per day (today = local date string)
export function applyRoundRewards(rewards, correct, rng, { reached = rewards.reached, today = null } = {}) {
  let sticker = null;
  if (correct === 0 && today && rewards.secretDay !== today) {
    const missing = missingOn(rewards, [SECRET_PAGE]);
    if (missing.length) sticker = pick(rng, missing);
  }
  const next = {
    ...rewards,
    ...(sticker ? { secretDay: today } : {}),
    stars: rewards.stars + correct,
    stickers: sticker ? [...rewards.stickers, sticker] : [...rewards.stickers],
    reached: { ...reached },
  };
  return {
    rewards: next,
    sticker,
    secret: sticker !== null,
    newlyUnlockedPages: PAGES.filter((p) => isPageOpen(next, p) && !isPageOpen(rewards, p)).map((p) => p.id),
  };
}
```

`js/session.js` `finishRound`: import `PACK_PRICE`; after computing `reached`:

```js
  // level gift: the first time an exercise reaches a level in a round, one pack of that level's page is free
  const gift = up && up.to > (profile.rewards.reached[id] ?? 0) ? PACK_PRICE[up.to] : 0;
  const reward = applyRoundRewards(profile.rewards, correct, rng, { reached, today: localDate(now) });
  const rewards = gift ? { ...reward.rewards, stars: reward.rewards.stars + gift } : reward.rewards;
```

and use `rewards` in the returned profile and `reward: { ...reward, rewards, levelUp: up, gift }`.

`js/profiles.js`: import `ALL_PAGES, MAX_PITY` from `./rewards.js` (check there is no import cycle: `rewards.js` must not import `profiles.js`) and add:

```js
// copies per owned sticker; 1 is the default and not stored
function sanitizeCounts(raw, stickers) {
  const r = isObj(raw) ? raw : {};
  return Object.fromEntries(stickers.filter((id) => Number.isInteger(r[id]) && r[id] > 1).map((id) => [id, r[id]]));
}
// duplicates in a row per page (bad-luck brake)
function sanitizePity(raw) {
  const r = isObj(raw) ? raw : {};
  return Object.fromEntries(ALL_PAGES.filter((p) => Number.isInteger(r[p.id]) && r[p.id] > 0 && r[p.id] <= MAX_PITY).map((p) => [p.id, r[p.id]]));
}
```

In `normalizeProfile` compute `const stickers = Array.isArray(rw.stickers) ? rw.stickers.filter((x) => typeof x === 'string') : [];` and set `stickers, counts: sanitizeCounts(rw.counts, stickers), pity: sanitizePity(rw.pity)` in `rewards`. In `createProfile` (`profiles.js:79`) add `counts: {}, pity: {}`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: PASS. `round-end.js` still imports `STICKER_MIN_CORRECT`; unit tests do not load it, e2e will be fixed in Task 6. Do not run e2e yet.

- [ ] **Step 5: Commit**

```bash
git add js/rewards.js js/session.js js/profiles.js tests/unit
git commit -m "feat: stars instead of automatic stickers, level gift, counts and pity in profiles"
```

---

### Task 4: Album — fifth tab, trade button, count badges

**Files:**
- Modify: `js/ui/album.js`
- Modify: `js/phrases.js` (pack phrases)
- Modify: `css/app.css` (album section)
- Test: `tests/e2e/album.spec.js`

**Interfaces:**
- Consumes: `ALL_PAGES, BONUS_PAGES, SECRET_PAGE, packPrice, isPageComplete, isPageVisible, countOf, openPack, stickerId, stickerUrl` from `js/rewards.js`; `updateProfile` from `js/profiles.js`; `ctx.setState`, `ctx.state`, `ctx.profile` (as used in `js/ui/round.js:119-120`).
- Produces: `render(root, ctx, { highlight = null, page = null })`; `page` is a page id to open on. Test ids: `album-tab-<pageId>`, `open-pack`, `page-complete`, `pack-result`, `sticker-count-<stickerId>`, `locked-page`.

- [ ] **Step 1: Write failing e2e tests**

In `tests/e2e/album.spec.js` change the first test's tab count to 5 per group and add:

```js
test('trading stars for a pack adds a sticker and lowers the balance', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stars = 12; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('open-pack')).toContainText('10');
  await page.getByTestId('open-pack').click();
  await expect(page.getByTestId('pack-result')).toBeVisible();
  await expect(page.getByTestId('star-badge')).toHaveText('2');
  await expect(page.locator('.sticker.collected')).toHaveCount(1);
  await expect(page.getByTestId('open-pack')).toBeDisabled();
  await page.getByTestId('open-pack').click({ force: true });
  await expect(page.getByTestId('star-badge')).toHaveText('2');
});

test('duplicates show a count badge; complete pages cannot be traded', async ({ page }) => {
  const fruit = ['pear', 'orange', 'lemon', 'pineapple', 'cherry', 'peach', 'kiwi', 'plum'].map((s) => `fruit/${s}`);
  await seed(page, (p) => { p.rewards.stickers = fruit; p.rewards.counts = { 'fruit/kiwi': 3 }; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('sticker-count-fruit/kiwi')).toHaveText('3');
  await expect(page.getByTestId('sticker-count-fruit/pear')).toHaveCount(0);
  await expect(page.getByTestId('page-complete')).toBeVisible();
  await expect(page.getByTestId('open-pack')).toHaveCount(0);
});

test('the bonus tab is locked until the exercise pages are full', async ({ page }) => {
  await seed(page, () => {});
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await page.getByTestId('album-tab-garden').click();
  await expect(page.getByTestId('locked-page')).toBeVisible();
});

test('a full exercise opens its bonus page for trading at 30 stars', async ({ page }) => {
  const pages = { fruit: ['pear', 'orange', 'lemon', 'pineapple', 'cherry', 'peach', 'kiwi', 'plum'],
    veggies: ['carrot', 'tomato', 'broccoli', 'corn', 'pepper', 'pumpkin', 'mushroom', 'toadstool'],
    treats: ['icecream', 'cake', 'grapes', 'banana', 'cocoa', 'cheese', 'watermelon', 'strawberry'],
    food: ['pizza', 'burger', 'taco', 'roastchicken', 'popsicle', 'birthdaycake', 'spaghetti', 'hotdog'] };
  await seed(page, (p) => {
    p.rewards.stars = 30;
    p.rewards.reached.quantity = 3;
    p.rewards.stickers = Object.entries(pages).flatMap(([id, s]) => s.map((n) => `${id}/${n}`));
  });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await page.getByTestId('album-tab-garden').click();
  await expect(page.getByTestId('open-pack')).toContainText('30');
  await page.getByTestId('open-pack').click();
  await expect(page.locator('.sticker.collected')).toHaveCount(1);
});
```

- [ ] **Step 2: Run e2e, verify they fail**

Run: `npx playwright test tests/e2e/album.spec.js`
Expected: FAIL (4 tabs, no `open-pack`).

- [ ] **Step 3: Implement the album**

Phrases in `js/phrases.js` (replace `STICKER`, `BONUS`, `ALMOST`):

```js
export const STICKER = ['Du hast einen neuen Sticker!', 'Ein neuer Sticker für dein Album!', 'Schau mal, ein neuer Sticker!'];
export const DUPLICATE = ['Den hast du schon – jetzt hast du ihn doppelt!', 'Noch einmal der! Der zählt mit.'];
export const TRADE = ['Du kannst eine Sticker-Tüte öffnen!', 'Deine Sterne reichen für eine Sticker-Tüte!'];
export const SAVE = ['Sammle weiter Sterne für die nächste Sticker-Tüte.', 'Bald reicht es für eine Sticker-Tüte!'];
export const BONUS_PAGE = 'Eine neue Bonusseite! Und dreißig Sterne dazu!';
```

(Remove any now-unused imports of `BONUS`/`ALMOST` elsewhere: `grep -rn "ALMOST\|BONUS\b" js`.)

`js/ui/album.js` — rework `render`:
1. Read rewards fresh on every `draw()`: `const rw = () => ctx.profile.rewards;` (verify in `js/app.js` that `ctx.profile` reflects `ctx.setState`; if it is a plain field, read it via `getActive(ctx.state)` from `js/profiles.js`).
2. Page list and indices: `const pages = () => (secretIds().length ? [...ALL_PAGES, SECRET_PAGE] : ALL_PAGES);` Initial index: from `page` option (`ALL_PAGES.findIndex((p) => p.id === page)`), else from `highlight` as today, else 0.
3. Tabs: per exercise group `ALL_PAGES.map((pg, i) => [pg, i]).filter(([pg]) => pg.exercise === ex)` — that yields 4 level pages then the bonus page. Badge: `pg.bonus ? uiIcon('star') : String(pg.level + 1)` inside `span.album-tab-level.medal-badge`; `aria-label`: `pg.bonus ? `${pg.title}, Bonusseite` : `${pg.title}, Level ${pg.level + 1}``. The secret tab's index becomes `ALL_PAGES.length`.
4. Locked page: bonus → text `Alle vier Seiten voll` next to the menu image, speech `Diese Bonusseite gibt es, wenn alle vier Seiten voll sind.`; level page as today.
5. Sticker slot: append the count badge when `countOf(rw(), id) >= 2`:
   `h('span', { class: 'sticker-count', 'data-testid': `sticker-count-${id}` }, String(n))`.
6. Below the grid, for every page except `SECRET_PAGE`:

```js
function tradeBar(pg) {
  if (isPageComplete(rw(), pg)) return h('div', { class: 'page-complete', 'data-testid': 'page-complete' }, uiIcon('check'), 'komplett');
  const price = packPrice(pg);
  return h('button', {
    class: 'candy pack-btn', 'data-testid': 'open-pack', disabled: rw().stars < price,
    'aria-label': `Sticker-Tüte öffnen für ${price} Sterne`, onClick: () => trade(pg),
  }, h('span', {}, 'Tüte öffnen ·'), h('span', {}, String(price)), uiIcon('star'));
}

function trade(pg) {
  const res = openPack(rw(), pg.id, Math.random);
  if (!res) return;
  ctx.setState(updateProfile(ctx.state, ctx.profile.id, (p) => ({ ...p, rewards: res.rewards })));
  ctx.sounds.fanfare();
  const say = res.unlockedBonus ? BONUS_PAGE : ctx.pick(res.duplicate ? 'duplicate' : 'sticker', res.duplicate ? DUPLICATE : STICKER);
  ctx.speech.speak(say);
  showPack(res); // overlay, see step 4
  starBadgeEl.replaceWith(starBadgeEl = starBadge(rw().stars));
  draw();
}
```

Keep a reference `let starBadgeEl = starBadge(...)` in the topbar so it can be refreshed.

- [ ] **Step 4: Pack opening overlay**

`showPack(res)` appends to `root` an overlay `div.pack-reveal[data-testid=pack-result][data-sticker=<id>]` containing the sticker image and, for duplicates, `span.pack-count` with `×${res.count}`; for `unlockedBonus` an extra line `uiIcon('album')` + `+30` + `uiIcon('star')`. With motion allowed (same check as `round-end.js`: `prefers-reduced-motion` and `Element.prototype.animate`), animate the card like `playReveal` in `round-end.js` (rotateY 180° → 0, 700 ms); the overlay closes on tap or after 2.5 s and then scrolls the new sticker slot into view and adds the existing `highlight` class to it. Without motion it shows statically and closes on tap / after 2.5 s. Track timers/animations and cancel them in the function returned by `render` (the router calls it on leave; follow the `round-end.js` pattern).

CSS in `css/app.css` (album section; remember `candy.css` loads later, so override candy props with `.candy.pack-btn`):

```css
.album-page .trade { display: flex; justify-content: center; margin-top: 12px; }
.candy.pack-btn { display: inline-flex; align-items: center; gap: 8px; font-size: 1.3rem; padding: 10px 22px; }
.candy.pack-btn:disabled { opacity: .5; filter: grayscale(.6); }
.page-complete { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--good, #2e9d57); }
.sticker { position: relative; }
.sticker-count { position: absolute; right: 4%; bottom: 4%; min-width: 1.6em; height: 1.6em; border-radius: 999px;
  background: #ff8a3d; color: #fff; font-weight: 800; display: grid; place-items: center; font-size: .9rem; box-shadow: 0 1px 3px #0004; }
.pack-reveal { position: fixed; inset: 0; display: grid; place-items: center; background: #0006; z-index: 20; }
.pack-reveal img { width: min(60vw, 260px); }
.pack-count { font-size: 2rem; font-weight: 800; color: #fff; text-shadow: 0 2px 4px #0008; }
```

Put the trade bar into `body` as `h('div', { class: 'trade' }, tradeBar(pg))` after the sticker grid.

- [ ] **Step 5: Run e2e, verify they pass; precache; unit tests**

```bash
npm run precache
npm test
npx playwright test tests/e2e/album.spec.js
```

Expected: PASS. Check visually with `npm run serve` at phone portrait and landscape that five tabs per group fit (the tab strip already scrolls horizontally).

- [ ] **Step 6: Commit**

```bash
git add js/ui/album.js js/phrases.js css/app.css sw.js tests/e2e/album.spec.js
git commit -m "feat: trade stars for sticker packs in the album, bonus tabs, duplicate badges"
```

---

### Task 5: Round end — trade hint, progress, level gift

**Files:**
- Modify: `js/ui/round-end.js`
- Modify: `css/app.css` (round-end section)
- Test: `tests/e2e/round.spec.js` (lines ~35, 55–56, 229–231, 260, 284, 297, 384–385)

**Interfaces:**
- Consumes: `reward` from `finishRound` (`{ sticker, secret, newlyUnlockedPages, levelUp, gift, rewards }`), `packTarget(rewards, exercise, level)`, `round.played` level → pass it to `renderRoundEnd` as `level` (from `js/ui/round.js:121`: `renderRoundEnd(root, ctx, { exerciseId, level: round.played, correct, reward })`); phrases `TRADE`, `SAVE`, `SECRET`.
- Produces: test ids `trade-hint` (button to the album), `pack-progress` (text + bar), `level-gift`; `new-sticker` stays only for the secret sticker.

- [ ] **Step 1: Update/write failing e2e tests**

In `tests/e2e/round.spec.js`:
- Tests that expected `new-sticker` after a good round (lines ~35, 229–231, 284) now expect, for a fresh profile with 5 correct (5 stars < 10): `await expect(page.getByTestId('pack-progress')).toContainText('Noch 5')`. Remove the `album-count` flight assertions at 229–231 and 260 or change them to `toHaveText('0')`.
- Line 55–56 (3 correct): expect `pack-progress` to contain `Noch 7`; `new-sticker` count 0.
- Line 297: replace `sticker-hint` with `pack-progress`.
- Lines 384–385 (secret sticker): keep `new-sticker` with `/^mischief\//`; replace `sticker-hint` count 0 with `trade-hint` count 0.
- Add:

```js
test('enough stars after a round: trade hint opens the album on the played page', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stars = 8; });
  // play a quantity round with at least 2 correct exactly like the first test in this file does
  await expect(page.getByTestId('trade-hint')).toBeVisible();
  await page.getByTestId('trade-hint').click();
  await expect(page.getByTestId('open-pack')).toBeEnabled();
  await expect(page.getByTestId('album-tab-fruit')).toHaveClass(/active/);
});
```

- In the existing level-up e2e test (search for `level-up`), add `await expect(page.getByTestId('level-gift')).toContainText('15')` (level 1 → 2).

- [ ] **Step 2: Run, verify they fail**

Run: `npx playwright test tests/e2e/round.spec.js`
Expected: FAIL (`STICKER_MIN_CORRECT` import error / missing test ids).

- [ ] **Step 3: Implement**

In `js/ui/round-end.js`:
- Imports: `import { stickerUrl, packTarget } from '../rewards.js';` and `import { PRAISE, SECRET, TRADE, SAVE, levelUpText } from '../phrases.js';`; signature `renderRoundEnd(root, ctx, { exerciseId, level, correct, reward })`.
- Replace the `prize` construction:

```js
  const target = packTarget(reward.rewards, exerciseId, level);
  const card = reward.sticker ? h('div', { class: 'sticker-reveal' }, h('img', { src: stickerUrl(reward.sticker), alt: '' })) : null;
  const prize = card
    ? h('div', { class: 'reveal', 'data-testid': 'new-sticker', 'data-sticker': reward.sticker }, rays, card)
    : !target ? null
      : target.affordable
        ? h('button', { class: 'candy trade-hint', 'data-testid': 'trade-hint', onClick: () => ctx.go('album', { page: target.page.id }) },
          uiIcon('album'), h('span', {}, 'Sticker-Tüte öffnen!'))
        : h('div', { class: 'pack-progress', 'data-testid': 'pack-progress' },
          h('span', {}, `Noch ${target.price - reward.rewards.stars}`), uiIcon('star'), h('span', {}, 'bis zur nächsten Tüte'),
          h('div', { class: 'pack-bar' }, h('div', { class: 'pack-fill', style: `width:${Math.round(100 * reward.rewards.stars / target.price)}%` })));
```

- Level gift inside the `levelUp` block: append `reward.gift ? h('span', { class: 'level-gift', 'data-testid': 'level-gift' }, `+${reward.gift}`, uiIcon('star')) : null` after the medal number.
- Album button: `total` = `ctx.profile.rewards.stickers.length` after the round; the count animation runs only for the secret sticker (`card && motion`), as today.
- Confetti: `share(correct) >= GREAT ? confetti() : null` (replaces `reward.earned`).
- Speech news: `reward.secret ? ctx.pick('secret', SECRET) : target?.affordable ? ctx.pick('trade', TRADE) : target ? ctx.pick('save', SAVE) : null`; add `reward.gift ? `Und ${reward.gift} Sterne als Geschenk!` : null` after the level-up text.

In `js/ui/round.js:121` pass `level: round.played`. In `js/app.js` / router make sure `ctx.go('album', { page })` forwards `page` to `album.render` the same way `highlight` is forwarded (grep `highlight` in `js/app.js`).

CSS (`css/app.css`, round-end section):

```css
.candy.trade-hint { display: inline-flex; align-items: center; gap: 10px; font-size: 1.3rem; padding: 12px 24px; }
.pack-progress { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; font-weight: 700; }
.pack-bar { flex-basis: 100%; height: 12px; border-radius: 999px; background: #0001; overflow: hidden; max-width: 260px; }
.pack-fill { height: 100%; background: linear-gradient(90deg, #ffd34d, #ff9f1c); }
.level-gift { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; }
```

- [ ] **Step 4: Run all tests**

```bash
npm run precache
npm test
npm run e2e
```

Expected: PASS (all suites). Check with `npm run serve` that the round end fits in phone landscape (two-column layout from 1.6.1).

- [ ] **Step 5: Commit**

```bash
git add js/ui/round-end.js js/ui/round.js js/app.js css/app.css sw.js tests/e2e/round.spec.js
git commit -m "feat: round end points to the sticker trade and shows the level gift"
```

---

### Task 6: Parent info, docs and release 1.8.0

**Files:**
- Modify: `js/ui/parents.js:237` (wording)
- Modify: `package.json` (version), `CHANGELOG.md`, `README.md` (if it describes sticker rules)
- Test: full suites

- [ ] **Step 1: Parent progress line**

`js/ui/parents.js:237`: `Sterne: ${p.rewards.stars} (Guthaben) · Sticker: ${p.rewards.stickers.length}`. Check `tests/e2e/parents.spec.js` for an assertion on this text and update it.

- [ ] **Step 2: Version and changelog**

`package.json` → `"version": "1.8.0"` (and any version constant the app shows: `grep -rn "1.7.1" --include=*.js --include=*.json --include=*.html --include=*.webmanifest .` outside `node_modules`). Add to the top of `CHANGELOG.md`:

```markdown
## 1.8.0 – 2026-10-04
- Sticker-Tausch: Sterne werden im Album gegen Sticker-Tüten getauscht (Level 1–4: 10/15/20/25, Bonusseiten: 30 Sterne).
- Doppelte Sticker zählen mit und zeigen eine Zahl; nach spätestens drei Doppelten in Folge kommt ein neuer Sticker.
- Level-Geschenk: Wer ein neues Level erreicht, bekommt eine Tüte dieser Stufe geschenkt.
- Vier Bonusseiten: Garten, Baustelle, Krabbeltiere, Alltagsfiguren – frei, wenn alle vier Seiten einer Übung voll sind.
- Mengenblitz zählt jetzt auch Garten-, Baustellen- und Krabbeltier-Sticker.
```

Update `README.md` only where it states the old rule "Sticker ab 4 von 5".

- [ ] **Step 3: Full verification**

```bash
npm run precache
npm test
npm run e2e
```

Expected: all PASS. Then `npm run serve` and click through: round → progress hint → album trade → duplicate badge → locked bonus tab.

- [ ] **Step 4: Commit, merge, tag (no push)**

```bash
git add -A
git status   # only intended files; nothing from _lokal/
git commit -m "chore: release notes and version 1.8.0"
git switch main
git merge --no-ff feat/1.8.0 -m "Merge branch 'feat/1.8.0': sticker trade, duplicates, bonus pages (1.8.0)"
git tag -a v1.8.0 -m "1.8.0: sticker trade, duplicates, bonus pages"
git log -3 --format="%h %ae %s"
```

Expected: all commits with the noreply address.

- [ ] **Step 5: Ask the user before pushing**

Ask: "1.8.0 ist lokal gemergt und getaggt. Soll ich `main`, den Tag `v1.8.0` pushen und den Branch `feat/1.8.0` löschen?" Only on yes:

```bash
git push origin main && git push origin v1.8.0
```
