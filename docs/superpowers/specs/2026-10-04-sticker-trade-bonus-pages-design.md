# Release 1.8.0: sticker trade, duplicates, bonus pages (design, 2026-10-04)

Audience: children in pre-school and grade 1 (round end, album).
Release target: 1.8.0 (base: `main` at `v1.7.1`).

## Goal
Stickers currently arrive almost every round (≥ 4 of 5 correct), so the album fills too fast. Turn stars into a currency the child trades for random sticker packs, priced by level, with duplicates counted on the sticker and a bad-luck brake so the randomness never gets frustrating. Add one bonus page per exercise for children who have filled their four level pages.

## Decisions (agreed with the user)
- D1 Stars stay at 1 per correct answer (max 5 per round). No half stars.
- D2 Stickers are no longer handed out automatically. The child trades stars for a pack in the album (variant A): one random sticker from the chosen page, duplicates included.
- D3 Pack price grows with the page: level 1 = 10, level 2 = 15, level 3 = 20, level 4 = 25, bonus page = 30 stars.
- D4 Duplicates show a small count badge ("×3") on the sticker.
- D5 Bad-luck brake: randomness decreases with every duplicate in a row, at most 3 duplicates in a row per page.
- D6 A complete page cannot be traded on (no duplicate farming).
- D7 Level gift: the first time an exercise reaches a new level in a round, the child gets the pack price of that level's page as free stars. Unlocking a bonus page gives 30 stars. Levels set by parents give no gift (`setLevel` stays untouched). No retroactive gifts.
- D8 One bonus page per exercise, opened when all stickers of that exercise's four level pages are collected:
  | Exercise | Page id | Title | Sheet |
  |---|---|---|---|
  | quantity | `garden` | Garten | `sticker-garten.jpg` |
  | digits | `construction` | Baustelle | `sticker-baustelle.jpg` |
  | letters | `bugs` | Krabbeltiere | `sticker-krabbeltiere.jpg` |
  | syllables | `everyday` | Alltagsfiguren | `sticker-alltagsfiguren.jpg` |
- D9 Alltagsfiguren: 8 of the 11 motifs. Kept: ice-cream cowboy, surfing rock, saxophone avocado, cloud robot, ballet pencil, mouse with hat (large), wrench scientist, pizza king. Dropped: small mouse (near duplicate), phone (English text "DATA"), battery with wall socket (two objects, friendly socket is a bad signal for small children).
- D10 `sticker-quatsch-2.jpg` (cute) stays unused: same eight figures as the secret page.
- D11 The secret page is unchanged: free sticker for a round with 0 correct, at most once per day, no stars spent, no duplicates.
- D12 Existing profiles keep their star count as spendable balance and their collected stickers (count 1 each).

## 1. Data model (`js/rewards.js`, `js/profiles.js`)
- `PAGES` stays the 4×4 level grid. New `BONUS_PAGES` with `{ id, title, exercise, bonus: true, stickers }`; `ALL_PAGES = [...PAGES, ...BONUS_PAGES]` for lookups.
- `PACK_PRICE = [10, 15, 20, 25]`, `BONUS_PACK_PRICE = 30`; `packPrice(page)`.
- `rewards` gains:
  - `counts: { [stickerId]: n }`: copies owned, n ≥ 1. A sticker is owned iff it is in `stickers` (unchanged list, first-collected order). Missing count = 1.
  - `pity: { [pageId]: d }`: duplicates in a row on that page, 0–3.
- `isPageOpen(rewards, page)`: level page → `reached[exercise] >= level` (as today); bonus page → every sticker of the exercise's four level pages is owned. The signature changes from `(reached, page)` to `(rewards, page)`; callers are updated.
- `sanitize` in `profiles.js` accepts `counts` (positive integers, only for owned ids) and `pity` (integers 0–3, known page ids); anything else is dropped.

## 2. Opening a pack: `openPack(rewards, pageId, rng)` (pure, `js/rewards.js`)
- Refuses (returns `null`) when the page is not open, is complete, or `stars < packPrice(page)`.
- With n stickers on the page, m missing and d = `pity[pageId]`: `pNew = min(1, m / n + d / 3)`.
  - `rng() < pNew` → uniformly one missing sticker; appended to `stickers`, count 1, pity reset to 0.
  - otherwise → uniformly one owned sticker of that page; count + 1, pity + 1.
  - A fresh page therefore always gives a new sticker first; after 3 duplicates in a row the next one is new.
- Subtracts the price. If the new sticker completes the last level page of an exercise, the bonus page opens: +30 stars, reported as `unlockedBonus: pageId`.
- Returns `{ rewards, sticker, duplicate: boolean, count, unlockedBonus }`.

## 3. Round rewards (`applyRoundRewards`, `finishRound`)
- `applyRoundRewards` no longer picks a sticker: it adds `correct` stars and handles the secret sticker as today. `STICKER_MIN_CORRECT`, `BONUS_STARS` and the tiered page choice are removed.
- Level gift: in `finishRound`, when `levelUp` raises `reached[exercise]` to a new value, add `PACK_PRICE[newLevel]` stars and report `gift` in the result.
- `newlyUnlockedPages` keeps reporting level pages unlocked by the round.

## 4. Round end (`js/ui/round-end.js`)
- Shows the stars of the round as today; the level celebration shows the gift ("+20 ⭐ Geschenk").
- The locked "ab 4 gibt's einen Sticker" line and the sticker flip are replaced by:
  - balance ≥ cheapest price among open, incomplete pages → "Du kannst eine Sticker-Tüte öffnen!" with a button to the album (opens on the page of the exercise and level just played if that one is affordable, else the first affordable one);
  - otherwise "Noch X ⭐ bis zur nächsten Tüte" with a small progress bar towards that cheapest price.
- The secret sticker reveal stays.
- All pages complete → only the stars, no trade hint.

## 5. Album (`js/ui/album.js`)
- Each exercise group gets a fifth tab for its bonus page with a star badge instead of the level number; locked shows the lock as usual. The secret page stays last.
- Open, incomplete page: candy button "Tüte öffnen · 20 ⭐"; disabled with the same label when the balance is too low. Complete page: a "komplett" mark instead of the button.
- Opening: pack shakes and opens, the sticker flips (reuse of the 1.6 flip/fly), lands on its slot; a duplicate shows "×n" counting up; the star badge counts down. Bonus unlock shows the existing unlock notice plus "+30 ⭐".
- Owned stickers with count ≥ 2 carry a small round count badge at the corner.

## 6. Mengenblitz (`js/exercises/quantity.js`)
- `garden`, `construction`, `bugs` join `COUNT_PAGES` (99 → 123 motifs). `everyday` stays out, like the Quatschwesen.

## 7. Assets (`tools/extract-sprites.mjs`, `tools/build-raster-assets.mjs`)
- Garten, Baustelle, Krabbeltiere: 3 rows on the sheet, row 3 repeats row 2 → only the 8 sprites of rows 1–2, row-major order.
- Alltagsfiguren: free layout → detect components, keep the 8 chosen ones by explicit position, fixed order as in D9.
- Then `build-raster-assets` (WebP) and `npm run precache`. The user reviews a contact sheet of the 32 new sprites before they are wired in.
- Sticker names (order = sheet order):
  - garden: sunflower, wateringcan, tulips, snail, butterfly, gnome, bee, flowerpot
  - construction: excavator, crane, dumptruck, hardhat, cone, mixer, wheelbarrow, hammer
  - bugs: ladybug, dragonfly, caterpillar, beetle, grasshopper, spider, firefly, worm
  - everyday: icecowboy, surfrock, saxavocado, cloudbot, balletpencil, mouse, wrenchscientist, pizzaking

## 8. Tests
- Unit (`tests/unit/`):
  - `openPack`: refuses on locked, complete or unaffordable page; subtracts price; fresh page gives a new sticker; duplicate raises count and pity; pity 3 forces a new sticker; completing the last level page opens the bonus page and adds 30 stars.
  - `applyRoundRewards`: adds stars, no sticker; secret sticker unchanged.
  - `finishRound`: level gift on a new level, none on an already reached level.
  - `isPageOpen` for bonus pages; `sanitize` for `counts` and `pity`; old profiles load with counts 1.
- E2E: trade a pack in the album (stars down, sticker shown); disabled button when too poor; count badge on a duplicate; fifth tab locked, open with a prepared full profile; round-end trade hint.

## Out of scope
- Bauernhof, Picknick, Bäckerei, Sport as a second bonus round (possibly generated with Gemini via the Playwright MCP). The model allows a list of bonus pages per exercise later.
- More stars per answer on higher levels (alternative lever if trading feels too slow; prices are constants and can be tuned).
- Using `sticker-quatsch-2.jpg` (cute).

## Release
Branch `feat/1.8.0`, commits with the noreply identity, version 1.8.0 + CHANGELOG, local `git merge --no-ff` into `main`, annotated tag `v1.8.0`; ask the user before pushing.
