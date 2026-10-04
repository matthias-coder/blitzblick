import { h } from './dom.js';
import { uiIcon } from './widgets.js';
import { stickerUrl, STICKER_MIN_CORRECT } from '../rewards.js';
import { ROUND_LENGTH } from '../session.js';
import { PRAISE, STICKER, BONUS, ALMOST, levelUpText } from '../phrases.js';

const decor = (name, cls) => h('img', { class: cls, src: `assets/decor/${name}.webp`, alt: '' });
export const HOLD_MS = 1800;

// thresholds as shares of the round so they keep working with any round length
export const GREAT = 0.8;
export const GOOD = 0.5;
const share = (correct) => correct / ROUND_LENGTH;

function confetti() {
  return h('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: 18 }, (_, i) => {
    const piece = decor(`confetti-${(i % 6) + 1}`, 'confetti-piece');
    piece.style.left = `${(i * 37) % 100}%`;
    piece.style.animationDelay = `${(i % 6) * 0.15}s`;
    piece.style.animationDuration = `${2.2 + (i % 4) * 0.4}s`;
    return piece;
  }));
}

// the sticker flips in over a ray burst, waits, then flies into the album button, which counts it
function playReveal({ card, rays, target, count, total }, track) {
  track(card.animate([
    { transform: 'rotateY(180deg) scale(.3)', opacity: 0 },
    { transform: 'rotateY(-12deg) scale(1.08)', opacity: 1, offset: 0.75 },
    { transform: 'rotateY(0) scale(1)', opacity: 1 },
  ], { duration: 700, easing: 'ease-out', fill: 'backwards' }));
  track(setTimeout(() => {
    const a = card.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const to = `translate(${dx}px, ${dy}px) scale(${(b.width / a.width).toFixed(3)})`;
    const fly = card.animate([
      { transform: 'none', opacity: 1 },
      { transform: to, opacity: 1, offset: 0.8 },
      { transform: to, opacity: 0 },
    ], { duration: 700, easing: 'ease-in', fill: 'forwards' });
    track(fly);
    track(rays.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' }));
    fly.finished.then(() => { count.textContent = String(total); target.classList.add('bump'); }, () => {});
  }, HOLD_MS));
}

export function renderRoundEnd(root, ctx, { exerciseId, correct, reward }) {
  const total = ctx.profile.rewards.stickers.length;
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof Element.prototype.animate === 'function';
  const animations = [], timers = [];
  const track = (x) => (typeof x === 'number' ? timers.push(x) : animations.push(x));
  const rays = h('div', { class: 'rays', 'aria-hidden': 'true' });
  const card = reward.sticker ? h('div', { class: 'sticker-reveal' }, h('img', { src: stickerUrl(reward.sticker), alt: '' })) : null;
  const prize = !reward.earned
    ? h('div', { class: 'sticker-hint', 'data-testid': 'sticker-hint' },
      uiIcon('lock'), h('span', {}, `${correct} von ${ROUND_LENGTH} – ab ${STICKER_MIN_CORRECT} gibt's einen Sticker`))
    : card
      ? h('div', { class: 'reveal', 'data-testid': 'new-sticker', 'data-sticker': reward.sticker }, rays, card)
      : h('div', { class: 'reveal' }, rays, h('div', { class: 'bonus', 'data-testid': 'bonus-stars' }, `+${reward.bonusStars}`, uiIcon('star')));
  const unlocked = reward.newlyUnlockedPages.length
    ? h('div', { class: 'unlock', 'data-testid': 'page-unlocked' }, uiIcon('album'), '+', String(reward.newlyUnlockedPages.length))
    : null;
  const levelUp = reward.levelUp
    ? h('div', { class: 'level-up', 'data-testid': 'level-up' }, `Level ${reward.levelUp.to + 1}!`)
    : null;
  const bubble = share(correct) >= GREAT ? decor('bubble-yay', 'end-bubble') : share(correct) >= GOOD ? decor('bubble-wow', 'end-bubble') : null;
  const btn = (icon, testid, label, onClick, extra = '') =>
    h('button', { class: `big-btn candy candy-round ${extra}`, 'data-testid': testid, 'aria-label': label, onClick }, uiIcon(icon));
  const count = h('span', { class: 'album-count', 'data-testid': 'album-count' }, String(card && motion ? total - 1 : total));
  const albumBtn = btn('album', 'to-album', 'Album', () => ctx.go('album', { highlight: reward.sticker }));
  albumBtn.append(count);

  root.replaceChildren(
    h('main', { class: 'round-end', 'data-testid': 'round-end' },
      reward.earned ? confetti() : null,
      h('div', { class: 'end-main' },
        h('div', { class: 'end-head' },
          bubble,
          h('div', { class: 'big-stars' }, decor('star-big', 'big-star'), h('span', {}, String(correct)))),
        prize,
        levelUp,
        unlocked),
      h('div', { class: 'end-actions' },
        btn('again', 'play-again', 'Nochmal', () => ctx.go('round', { exerciseId })),
        albumBtn,
        btn('check', 'round-done', 'Fertig', () => ctx.go('menu'), 'is-go'))),
    h('img', { class: 'mascot', src: `assets/mascot/${share(correct) >= GOOD ? 'robot-cheer' : 'robot-wave'}.webp`, alt: '' }),
  );
  if (card && motion) playReveal({ card, rays, target: albumBtn, count, total }, track);
  ctx.sounds.fanfare();
  const praise = ctx.pick('praise', PRAISE[share(correct) >= GREAT ? 'great' : share(correct) >= GOOD ? 'good' : 'practiced']);
  const news = !reward.earned ? ctx.pick('almost', ALMOST) : reward.sticker ? ctx.pick('sticker', STICKER) : ctx.pick('bonus', BONUS);
  ctx.speech.speak([praise, reward.levelUp ? levelUpText(reward.levelUp.from) : null, news].filter(Boolean).join(' '));
  return () => { timers.forEach(clearTimeout); animations.forEach((a) => a.cancel()); };
}
