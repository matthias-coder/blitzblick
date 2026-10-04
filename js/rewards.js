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

export const BONUS_STARS = 3;
export const STICKER_MIN_CORRECT = 4;

export const stickerId = (page, name) => `${page}/${name}`;
export const stickerUrl = (id) => `assets/stickers/${id}.webp`;
const idsOf = (page) => page.stickers.map((s) => stickerId(page.id, s));

export const isPageOpen = (reached, page) => (reached?.[page.exercise] ?? 0) >= page.level;
// a page with collected stickers stays visible even if its level was not reached (e.g. stickers from before 1.7)
export const isPageVisible = (rewards, page) => isPageOpen(rewards.reached, page) || idsOf(page).some((id) => rewards.stickers.includes(id));

const missingOn = (rewards, pages) => pages.flatMap(idsOf).filter((id) => !rewards.stickers.includes(id));

// sticker from the page just played, else another open page of that exercise, else any open page; all full → bonus stars.
// No correct answer at all: a missing secret sticker, at most one per day (today = local date string)
export function applyRoundRewards(rewards, correct, rng, { exercise, level, reached = rewards.reached, today = null }) {
  const open = PAGES.filter((p) => isPageOpen(reached, p));
  const earned = correct >= STICKER_MIN_CORRECT;
  let sticker = null;
  let bonusStars = 0;
  if (earned) {
    const tiers = [open.filter((p) => p.exercise === exercise && p.level === level), open.filter((p) => p.exercise === exercise), open];
    for (const pages of tiers) {
      const missing = missingOn(rewards, pages);
      if (missing.length) { sticker = pick(rng, missing); break; }
    }
    if (!sticker) bonusStars = BONUS_STARS;
  }
  let secret = false;
  if (correct === 0 && today && rewards.secretDay !== today) {
    const missing = missingOn(rewards, [SECRET_PAGE]);
    if (missing.length) { sticker = pick(rng, missing); secret = true; }
  }
  return {
    rewards: {
      ...rewards,
      ...(secret ? { secretDay: today } : {}),
      stars: rewards.stars + correct + bonusStars,
      stickers: sticker ? [...rewards.stickers, sticker] : [...rewards.stickers],
      reached: { ...reached },
    },
    sticker,
    bonusStars,
    earned,
    secret,
    newlyUnlockedPages: PAGES.filter((p) => isPageOpen(reached, p) && !isPageOpen(rewards.reached, p)).map((p) => p.id),
  };
}
