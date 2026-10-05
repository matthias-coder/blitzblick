import { PAGES, BONUS_PAGES, SECRET_PAGE, isPageVisible, pageById } from './rewards.js';
import { EXERCISE_ORDER } from './exercises/index.js';

// the album is split into worlds: one per exercise, the bonus pages, and the secret page once found
export const WORLD_LABELS = { quantity: 'Mengen', digits: 'Zahlen', letters: 'Buchstaben', syllables: 'Silben', bonus: 'Bonus' };

export const worldOf = (page) => (page === SECRET_PAGE ? 'secret' : page.bonus ? 'bonus' : page.exercise);

export function pagesOf(world) {
  if (world === 'secret') return [SECRET_PAGE];
  if (world === 'bonus') return BONUS_PAGES;
  return PAGES.filter((p) => p.exercise === world);
}

export const bonusWorldVisible = (rewards) => BONUS_PAGES.some((p) => isPageVisible(rewards, p));

export function lastPlayed(history) {
  const ex = history?.at(-1)?.exercise;
  return EXERCISE_ORDER.includes(ex) ? ex : 'quantity';
}

export function defaultPage(profile, world) {
  const pages = pagesOf(world);
  if (world === 'secret') return SECRET_PAGE;
  if (world === 'bonus') return pages.find((p) => isPageVisible(profile.rewards, p)) ?? pages[0];
  const level = profile.levels?.[world]?.level ?? 0;
  return pages.find((p) => p.level === level) ?? pages[0];
}

// an asked-for page (trade hint) or the page of a highlighted sticker; else the last played exercise
export function albumStart(profile, { page = null, highlight = null } = {}) {
  const asked = page ? pageById(page) : highlight ? pageById(highlight.split('/')[0]) : null;
  if (asked) return { world: worldOf(asked), pageId: asked.id };
  const world = lastPlayed(profile.history);
  return { world, pageId: defaultPage(profile, world).id };
}
