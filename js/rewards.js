import { pick } from './rng.js';

export const PAGES = [
  { id: 'animals', title: 'Tiere', stickers: ['lion', 'elephant', 'giraffe', 'monkey', 'penguin', 'turtle', 'zebra', 'hedgehog'] },
  { id: 'vehicles', title: 'Fahrzeuge', stickers: ['car', 'bus', 'train', 'plane', 'ship', 'bike', 'tractor', 'firetruck'] },
  { id: 'space', title: 'Weltraum', stickers: ['rocket', 'moon', 'sun', 'planet', 'star', 'astronaut', 'ufo', 'comet'] },
  { id: 'sea', title: 'Meer', stickers: ['fish', 'octopus', 'crab', 'whale', 'starfish', 'seahorse', 'jellyfish', 'shell'] },
  { id: 'dinos', title: 'Dinos', stickers: ['trex', 'stegosaurus', 'triceratops', 'brachiosaurus', 'pterodactyl', 'egg', 'volcano', 'footprint'] },
  { id: 'toys', title: 'Spielzeug', stickers: ['teddy', 'train', 'hotairballoon', 'helicopter', 'rocket', 'sailboat', 'yoyo', 'blocks'] },
  { id: 'treats', title: 'Leckereien', stickers: ['icecream', 'cake', 'grapes', 'banana', 'cocoa', 'cheese', 'watermelon', 'strawberry'] },
  { id: 'kitchen', title: 'Küche', stickers: ['pot', 'bread', 'spatula', 'mug', 'whisk', 'rollingpin', 'salad', 'cereal'] },
  { id: 'magic', title: 'Zauberei', stickers: ['wand', 'spellbook', 'crystals', 'potion', 'broom', 'telescope', 'globe', 'camera'] },
  { id: 'room', title: 'Mein Zimmer', stickers: ['cat', 'pencils', 'backpack', 'book', 'headphones', 'sneakers', 'flowers', 'drawingbook'] },
  // v1.4 pages: sticker order = row-major order on the artwork sheet (tools/extract-sprites.mjs)
  { id: 'silly', title: 'Quatschwesen', stickers: ['tralalero', 'bombardiro', 'tungtung', 'ballerina', 'patapim', 'lirili', 'chimpanzini', 'trippitroppi'] },
  { id: 'cooking', title: 'Kochen', stickers: ['pan', 'ladle', 'kettle', 'toaster', 'grater', 'colander', 'ovenmitt', 'bowl'] },
  { id: 'food', title: 'Essen', stickers: ['pizza', 'burger', 'taco', 'roastchicken', 'popsicle', 'birthdaycake', 'spaghetti', 'hotdog'] },
  { id: 'veggies', title: 'Gemüse & Pilze', stickers: ['carrot', 'tomato', 'broccoli', 'corn', 'pepper', 'pumpkin', 'mushroom', 'toadstool'] },
  { id: 'fruit', title: 'Obst', stickers: ['pear', 'orange', 'lemon', 'pineapple', 'cherry', 'peach', 'kiwi', 'plum'] },
];
export const STARS_PER_PAGE = 50;
export const BONUS_STARS = 3;
export const STICKER_MIN_CORRECT = 8;

export const stickerId = (page, name) => `${page}/${name}`;
export const stickerUrl = (id) => `assets/stickers/${id}.webp`;

export function unlockedPagesFor(stars) {
  return Math.min(PAGES.length, 1 + Math.floor(stars / STARS_PER_PAGE));
}

export function missingStickers(rewards) {
  return PAGES.slice(0, rewards.unlockedPages)
    .flatMap((p) => p.stickers.map((s) => stickerId(p.id, s)))
    .filter((id) => !rewards.stickers.includes(id));
}

export function applyRoundRewards(rewards, correct, rng) {
  let stars = rewards.stars + correct;
  let unlocked = Math.max(rewards.unlockedPages, unlockedPagesFor(stars));
  const missing = missingStickers({ ...rewards, unlockedPages: unlocked });
  const earned = correct >= STICKER_MIN_CORRECT;
  let sticker = null;
  let bonusStars = 0;
  if (earned && missing.length) {
    sticker = pick(rng, missing);
  } else if (earned) {
    bonusStars = BONUS_STARS;
    stars += BONUS_STARS;
    unlocked = Math.max(unlocked, unlockedPagesFor(stars));
  }
  return {
    rewards: { stars, stickers: sticker ? [...rewards.stickers, sticker] : [...rewards.stickers], unlockedPages: unlocked },
    sticker,
    bonusStars,
    earned,
    newlyUnlockedPages: PAGES.slice(rewards.unlockedPages, unlocked).map((p) => p.id),
  };
}
