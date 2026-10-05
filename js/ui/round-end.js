import { h } from './dom.js';
import { uiIcon } from './widgets.js';
import { stickerUrl, packTarget } from '../rewards.js';
import { stickerName } from '../sticker-names.js';
import { ROUND_LENGTH } from '../session.js';
import { PRAISE, SECRET, TRADE, SAVE, levelUpText } from '../phrases.js';

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

export function renderRoundEnd(root, ctx, { exerciseId, level, correct, reward }) {
  const total = ctx.profile.rewards.stickers.length;
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof Element.prototype.animate === 'function';
  const animations = [], timers = [];
  const track = (x) => (typeof x === 'number' ? timers.push(x) : animations.push(x));
  const rays = h('div', { class: 'rays', 'aria-hidden': 'true' });
  const card = reward.sticker
    ? h('div', { class: 'sticker-reveal' }, h('img', { src: stickerUrl(reward.sticker), alt: stickerName(reward.sticker) }))
    : null;
  const target = packTarget(reward.rewards, exerciseId, level);
  const owned = reward.rewards.stars;
  // #16: one central star with this round's stars, ringed by the progress toward the next pack
  const ratio = target ? Math.min(1, owned / target.price) : 1;
  const ringText = !target ? null : target.affordable ? 'Genug Sterne für eine Sticker-Tüte' : `Noch ${target.price - owned} Sterne bis zur nächsten Tüte`;
  const ring = h('div', { class: `end-ring${target ? '' : ' no-ring'}`, 'data-testid': 'end-ring', style: `--p:${ratio.toFixed(3)}` },
    decor('star-big', 'big-star'),
    h('span', { class: 'end-count' }, String(correct)),
    ringText ? h('span', { class: 'sr-only' }, ringText) : null);
  const prize = card
    ? h('div', { class: 'reveal', 'data-testid': 'new-sticker', 'data-sticker': reward.sticker }, rays, card)
    : target?.affordable
      ? h('button', { class: 'candy trade-hint', 'data-testid': 'trade-hint', onClick: () => ctx.go('album', { page: target.page.id }) },
        uiIcon('album'), h('span', {}, 'Sticker-Tüte öffnen!'))
      : null;
  const unlocked = reward.newlyUnlockedPages.length
    ? h('div', { class: 'unlock', 'data-testid': 'page-unlocked' }, uiIcon('album'), '+', String(reward.newlyUnlockedPages.length))
    : null;
  // level-up: the robot holds a trophy and a medal shows the new level number
  const levelUp = reward.levelUp
    ? h('div', { class: 'level-up', 'data-testid': 'level-up', role: 'img', 'aria-label': `Level ${reward.levelUp.to + 1}` },
      decor('medal', 'medal'), h('span', { class: 'medal-num', 'data-testid': 'level-up-num' }, String(reward.levelUp.to + 1)),
      reward.gift ? h('span', { class: 'level-gift', 'data-testid': 'level-gift' }, `+${reward.gift}`, uiIcon('star')) : null)
    : null;
  // medal and unlocked page share a row; on phones the trophy robot joins them instead of hiding behind the buttons
  const prizeRow = levelUp || unlocked
    ? h('div', { class: 'end-row' },
      levelUp ? h('img', { class: 'level-up-robot', src: 'assets/mascot/robot-trophy.webp', alt: '' }) : null, levelUp, unlocked)
    : null;
  const mascot = reward.levelUp ? 'robot-trophy' : share(correct) >= GOOD ? 'robot-cheer' : 'robot-wave';
  const bubble = share(correct) >= GREAT ? decor('bubble-yay', 'end-bubble') : share(correct) >= GOOD ? decor('bubble-wow', 'end-bubble') : null;
  const btn = (icon, testid, label, onClick, extra = '') =>
    h('button', { class: `big-btn candy candy-round ${extra}`, 'data-testid': testid, 'aria-label': label, onClick }, uiIcon(icon));
  const count = h('span', { class: 'album-count', 'data-testid': 'album-count' }, String(card && motion ? total - 1 : total));
  const albumBtn = btn('album', 'to-album', 'Album', () => ctx.go('album', { highlight: reward.sticker }));
  albumBtn.append(count);

  root.replaceChildren(
    h('main', { class: 'round-end', 'data-testid': 'round-end' },
      share(correct) >= GREAT ? confetti() : null,
      h('div', { class: 'end-main' },
        h('div', { class: 'end-head' },
          bubble,
          ring),
        prize,
        prizeRow),
      h('div', { class: 'end-actions' },
        btn('again', 'play-again', 'Nochmal', () => ctx.go('round', { exerciseId })),
        albumBtn,
        btn('home', 'round-done', 'Fertig', () => ctx.go('menu'), 'is-go'))),
    h('img', { class: reward.levelUp ? 'mascot mascot-trophy' : 'mascot', src: `assets/mascot/${mascot}.webp`, 'data-testid': 'end-mascot', alt: '' }),
  );
  if (card && motion) playReveal({ card, rays, target: albumBtn, count, total }, track);
  ctx.sounds.fanfare();
  const praise = ctx.pick('praise', PRAISE[share(correct) >= GREAT ? 'great' : share(correct) >= GOOD ? 'good' : 'practiced']);
  const news = reward.secret ? ctx.pick('secret', SECRET) : target?.affordable ? ctx.pick('trade', TRADE) : target ? ctx.pick('save', SAVE) : null;
  ctx.speech.speak([praise, reward.levelUp ? levelUpText(reward.levelUp.from) : null, reward.gift ? `Und ${reward.gift} Sterne als Geschenk!` : null, news].filter(Boolean).join(' '));
  return () => { timers.forEach(clearTimeout); animations.forEach((a) => a.cancel()); };
}
