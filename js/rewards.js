import { pick } from './rng.js';

// one page per exercise and level number (shared by all grades), in album order
export const PAGES = [
  { id: 'fruit', title: 'Obst', exercise: 'quantity', level: 0, stickers: ['pear', 'orange', 'lemon', 'pineapple', 'cherry', 'peach', 'kiwi', 'plum'] },
  { id: 'veggies', title: 'Gemüse & Pilze', exercise: 'quantity', level: 1, stickers: ['carrot', 'tomato', 'broccoli', 'corn', 'pepper', 'pumpkin', 'mushroom', 'toadstool'] },
  { id: 'treats', title: 'Leckereien', exercise: 'quantity', level: 2, stickers: ['icecream', 'cake', 'grapes', 'banana', 'cocoa', 'cheese', 'watermelon', 'strawberry'] },
  { id: 'food', title: 'Essen', exercise: 'quantity', level: 3, stickers: ['pizza', 'burger', 'taco', 'roastchicken', 'popsicle', 'birthdaycake', 'spaghetti', 'hotdog'] },
  { id: 'toys', title: 'Spielzeug', exercise: 'digits', level: 0, stickers: ['teddy', 'train', 'hotairballoon', 'helicopter', 'rocket', 'sailboat', 'yoyo', 'blocks'] },
  { id: 'vehicles', title: 'Fahrzeuge', exercise: 'digits', level: 1, stickers: ['car', 'bus', 'train', 'plane', 'ship', 'bike', 'tractor', 'firetruck'] },
  { id: 'space', title: 'Weltraum', exercise: 'digits', level: 2, stickers: ['rocket', 'moon', 'sun', 'planet', 'star', 'astronaut', 'ufo', 'comet'] },
  { id: 'blockworld', title: 'Klötzchenwelt', exercise: 'digits', level: 3, stickers: ['pickaxe', 'sword', 'grassblock', 'crystal', 'chest', 'slime', 'sixtyseven'] },
  { id: 'animals', title: 'Tiere', exercise: 'letters', level: 0, stickers: ['lion', 'elephant', 'giraffe', 'monkey', 'penguin', 'turtle', 'zebra', 'hedgehog'] },
  { id: 'sea', title: 'Meer', exercise: 'letters', level: 1, stickers: ['fish', 'octopus', 'crab', 'whale', 'starfish', 'seahorse', 'jellyfish', 'shell'] },
  { id: 'dinos', title: 'Dinos', exercise: 'letters', level: 2, stickers: ['trex', 'stegosaurus', 'triceratops', 'brachiosaurus', 'pterodactyl', 'egg', 'volcano', 'footprint'] },
  // v1.4 page: sticker order = row-major order on the artwork sheet (tools/extract-sprites.mjs)
  { id: 'silly', title: 'Quatschwesen', exercise: 'letters', level: 3, stickers: ['tralalero', 'bombardiro', 'tungtung', 'ballerina', 'patapim', 'lirili', 'chimpanzini', 'trippitroppi'] },
  { id: 'room', title: 'Mein Zimmer', exercise: 'syllables', level: 0, stickers: ['cat', 'pencils', 'backpack', 'book', 'headphones', 'sneakers', 'flowers', 'drawingbook'] },
  { id: 'kitchen', title: 'Küche', exercise: 'syllables', level: 1, stickers: ['pot', 'bread', 'spatula', 'mug', 'whisk', 'rollingpin', 'salad', 'cereal'] },
  { id: 'cooking', title: 'Kochen', exercise: 'syllables', level: 2, stickers: ['pan', 'ladle', 'kettle', 'toaster', 'grater', 'colander', 'ovenmitt', 'bowl'] },
  { id: 'magic', title: 'Zauberei', exercise: 'syllables', level: 3, stickers: ['wand', 'spellbook', 'crystals', 'potion', 'broom', 'telescope', 'globe', 'camera'] },
];
// easter egg: hidden page, filled only by rounds with no correct answer (one sticker per day); not part of the level grid
export const SECRET_PAGE = { id: 'mischief', title: 'Unfug-Bande', stickers: ['toast', 'toaster', 'finger', 'bubbletea', 'broccoli', 'shroomrider', 'yarncat', 'melon'] };

// v1.8: one bonus page per exercise, opened when the exercise's four level pages are complete (see isPageOpen)
export const BONUS_PAGES = [
  { id: 'garden', title: 'Garten', exercise: 'quantity', bonus: true, stickers: ['sunflower', 'wateringcan', 'tulips', 'snail', 'butterfly', 'gnome', 'bee', 'flowerpot'] },
  { id: 'construction', title: 'Baustelle', exercise: 'digits', bonus: true, stickers: ['excavator', 'crane', 'dumptruck', 'hardhat', 'cone', 'mixer', 'wheelbarrow', 'hammer'] },
  { id: 'bugs', title: 'Krabbeltiere', exercise: 'letters', bonus: true, stickers: ['ladybug', 'dragonfly', 'caterpillar', 'beetle', 'grasshopper', 'spider', 'firefly', 'worm'] },
  { id: 'everyday', title: 'Alltagsfiguren', exercise: 'syllables', bonus: true, stickers: ['icecowboy', 'surfrock', 'saxavocado', 'cloudbot', 'balletpencil', 'mouse', 'wrenchscientist', 'pizzaking'] },
];
export const ALL_PAGES = [...PAGES, ...BONUS_PAGES];
export const pageById = (id) => (id === SECRET_PAGE.id ? SECRET_PAGE : ALL_PAGES.find((p) => p.id === id) ?? null);

export const stickerId = (page, name) => `${page}/${name}`;
export const stickerUrl = (id) => `assets/stickers/${id}.webp`;
const idsOf = (page) => page.stickers.map((s) => stickerId(page.id, s));

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

const missingOn = (rewards, pages) => pages.flatMap(idsOf).filter((id) => !rewards.stickers.includes(id));

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
