import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, BONUS_PAGES, ALL_PAGES, pageById, SECRET_PAGE, applyRoundRewards, isPageOpen, isPageVisible, isPageComplete, PACK_PRICE, BONUS_PACK_PRICE, packPrice, countOf, canTrade, openPack, packTarget, stickerUrl, stickerId } from '../../js/rewards.js';
import { EXERCISE_ORDER } from '../../js/exercises/index.js';
import { LEVEL_COUNT } from '../../js/levels.js';
import { mulberry32 } from '../../js/rng.js';

const none = () => ({ quantity: 0, digits: 0, letters: 0, syllables: 0 });
const fresh = () => ({ stars: 0, stickers: [], reached: none() });
const idsOfPage = (p) => p.stickers.map((s) => stickerId(p.id, s));
const ids = (pageId) => PAGES.find((p) => p.id === pageId).stickers.map((s) => stickerId(pageId, s));
const play = (rewards, correct, seed, exercise = 'quantity', level = 0, reached = rewards.reached) =>
  applyRoundRewards(rewards, correct, mulberry32(seed), { exercise, level, reached });

test('sixteen pages with unique stickers, eight each except the seven-sticker block world', () => {
  assert.equal(PAGES.length, 16);
  for (const p of PAGES) assert.equal(new Set(p.stickers).size, p.id === 'blockworld' ? 7 : 8);
});

test('exactly one page per exercise and level, grouped in menu order', () => {
  const keys = PAGES.map((p) => `${p.exercise}/${p.level}`);
  assert.deepEqual(keys, EXERCISE_ORDER.flatMap((ex) => Array.from({ length: LEVEL_COUNT }, (_, l) => `${ex}/${l}`)));
});

test('pages open with the level reached; pages with collected stickers stay visible', () => {
  const fruit = PAGES.find((p) => p.id === 'fruit');
  const food = PAGES.find((p) => p.id === 'food');
  assert.equal(isPageOpen(fresh(), fruit), true);
  assert.equal(isPageOpen(fresh(), food), false);
  assert.equal(isPageOpen({ ...fresh(), reached: { ...none(), quantity: 3 } }, food), true);
  assert.equal(isPageVisible({ ...fresh(), stickers: ['food/pizza'] }, food), true);
  assert.equal(isPageVisible(fresh(), food), false);
});

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

test('input rewards are not mutated', () => {
  const before = fresh();
  play(before, 5, 6);
  assert.deepEqual(before, fresh());
});

test('stickerUrl', () => {
  assert.equal(stickerUrl('sea/fish'), 'assets/stickers/sea/fish.webp');
});

const secretIds = SECRET_PAGE.stickers.map((s) => stickerId(SECRET_PAGE.id, s));
const playOn = (rewards, correct, today, seed = 1) =>
  applyRoundRewards(rewards, correct, mulberry32(seed), { exercise: 'quantity', level: 0, reached: rewards.reached, today });

test('the secret page is separate from the level pages and has eight stickers', () => {
  assert.equal(SECRET_PAGE.stickers.length, 8);
  assert.ok(!PAGES.some((p) => p.id === SECRET_PAGE.id));
});

test('a round with no correct answer gives one secret sticker per day', () => {
  const r = playOn(fresh(), 0, '2026-10-05');
  assert.equal(r.secret, true);
  assert.ok(secretIds.includes(r.sticker));
  assert.deepEqual(r.rewards.stickers, [r.sticker]);
  assert.equal(r.rewards.secretDay, '2026-10-05');
  assert.equal(r.rewards.stars, 0);
  const again = playOn(r.rewards, 0, '2026-10-05', 2);
  assert.equal(again.secret, false);
  assert.equal(again.sticker, null);
  assert.deepEqual(again.rewards.stickers, r.rewards.stickers);
  const next = playOn(r.rewards, 0, '2026-10-06', 3);
  assert.equal(next.secret, true);
  assert.notEqual(next.sticker, r.sticker);
});

test('no secret sticker with any correct answer, without a date or on a full page', () => {
  for (const c of [1, 2, 3]) assert.equal(playOn(fresh(), c, '2026-10-05').secret, false);
  assert.equal(play(fresh(), 0, 1).secret, false);
  const full = playOn({ ...fresh(), stickers: [...secretIds] }, 0, '2026-10-05');
  assert.equal(full.secret, false);
  assert.equal(full.sticker, null);
  assert.equal(full.rewards.secretDay, undefined);
});

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

const withPages = (rewards, pageIds) => ({ ...rewards, stickers: [...rewards.stickers, ...pageIds.flatMap(ids)] });
const levelIds = (exercise) => PAGES.filter((p) => p.exercise === exercise).map((p) => p.id);
const rich = (stars = 1000) => ({ ...fresh(), stars });
const always = (v) => () => v; // fake rng

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
