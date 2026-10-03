import { h } from './dom.js';
import { uiIcon } from './widgets.js';
import { stickerUrl } from '../rewards.js';

const decor = (name, cls) => h('img', { class: cls, src: `assets/decor/${name}.png`, alt: '' });

function confetti() {
  return h('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: 18 }, (_, i) => {
    const piece = decor(`confetti-${(i % 6) + 1}`, 'confetti-piece');
    piece.style.left = `${(i * 37) % 100}%`;
    piece.style.animationDelay = `${(i % 6) * 0.15}s`;
    piece.style.animationDuration = `${2.2 + (i % 4) * 0.4}s`;
    return piece;
  }));
}

export function renderRoundEnd(root, ctx, { exerciseId, correct, reward }) {
  const prize = reward.sticker
    ? h('div', { class: 'sticker-reveal', 'data-testid': 'new-sticker', 'data-sticker': reward.sticker },
      h('img', { src: stickerUrl(reward.sticker), alt: '' }))
    : h('div', { class: 'bonus', 'data-testid': 'bonus-stars' }, `+${reward.bonusStars}`, uiIcon('star'));
  const unlocked = reward.newlyUnlockedPages.length
    ? h('div', { class: 'unlock', 'data-testid': 'page-unlocked' }, uiIcon('album'), '+', String(reward.newlyUnlockedPages.length))
    : null;
  const bubble = correct >= 8 ? decor('bubble-yay', 'end-bubble') : correct >= 5 ? decor('bubble-wow', 'end-bubble') : null;
  const btn = (icon, testid, label, onClick, extra = '') =>
    h('button', { class: `big-btn ${extra}`, 'data-testid': testid, 'aria-label': label, onClick }, uiIcon(icon));

  root.replaceChildren(
    h('main', { class: 'round-end', 'data-testid': 'round-end' },
      confetti(),
      h('div', { class: 'end-head' },
        bubble,
        h('div', { class: 'big-stars' }, decor('star-big', 'big-star'), h('span', {}, String(correct)))),
      prize,
      unlocked,
      h('div', { class: 'end-actions' },
        btn('again', 'play-again', 'Nochmal', () => ctx.go('round', { exerciseId })),
        btn('album', 'to-album', 'Album', () => ctx.go('album', { highlight: reward.sticker })),
        btn('check', 'round-done', 'Fertig', () => ctx.go('menu'), 'go'))),
    h('img', { class: 'mascot', src: 'assets/mascot/robot-wave.png', alt: '' }),
  );
  ctx.sounds.fanfare();
  const praise = correct >= 8 ? 'Super gemacht!' : correct >= 5 ? 'Gut gemacht!' : 'Toll geübt!';
  ctx.speech.speak(reward.sticker ? `${praise} Du hast einen neuen Sticker!` : `${praise} Du bekommst Extra-Sterne!`);
}
