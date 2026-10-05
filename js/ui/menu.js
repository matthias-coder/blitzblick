import { h, fitText } from './dom.js';
import { stickerUrl } from '../rewards.js';
import { EXERCISES, EXERCISE_ORDER } from '../exercises/index.js';
import { iconBtn, starBadge, avatarImg, uiIcon } from './widgets.js';
import { attachLongPress } from './gate.js';

export function render(root, ctx) {
  const p = ctx.profile;
  const ids = EXERCISE_ORDER.filter((id) => p.settings.exercises[id] && EXERCISES[id].isAvailable(p.settings));
  const gear = iconBtn('gear', 'Elternbereich: 1,5 Sekunden gedrückt halten', null, 'gear');
  gear.classList.add('gear');
  attachLongPress(gear, 1500, () => ctx.go('parents'));
  const who = ctx.state.profiles.length > 1
    ? h('button', { class: 'icon-btn candy candy-round', 'data-testid': 'switch-profile', 'aria-label': 'Profil wechseln', onClick: () => ctx.go('profiles') }, avatarImg(p.avatar))
    : h('div', { class: 'icon-btn' }, avatarImg(p.avatar));
  const hello = `Hallo ${p.name}! Was möchtest du üben?`;
  const last = p.rewards.stickers.at(-1);
  // #29: a small sticker next to the count says what the number counts
  const mini = h('img', { class: `mini-sticker${last ? '' : ' empty'}`, src: stickerUrl(last ?? 'fruit/pear'), alt: '' });
  root.append(
    h('h1', { class: 'sr-only' }, 'Blitzblick – Übungen'),
    h('header', { class: 'topbar' }, who, h('div', { class: 'spacer' }), starBadge(p.rewards.stars), gear),
    h('div', { class: 'greet' },
      h('img', { class: 'greet-robot', src: 'assets/mascot/robot-wave.webp', alt: '' }),
      h('p', { class: 'bubble', 'data-testid': 'greet' }, hello)),
    h('main', { class: `menu count-${ids.length}` }, ids.map((id) => h('button', {
      class: `tile tile-${id} candy candy-tile`,
      'data-testid': `tile-${id}`,
      'aria-label': EXERCISES[id].menuTitle,
      onClick: () => ctx.go('round', { exerciseId: id }),
    }, h('img', { src: `assets/menu/${id}.webp`, alt: '' }), h('span', { class: 'tile-name', 'aria-hidden': 'true' }, EXERCISES[id].menuTitle)))),
    h('footer', { class: 'menu-foot' }, h('button', {
      class: 'album-btn candy candy-pill', 'data-testid': 'open-album', 'aria-label': 'Sammelalbum', onClick: () => ctx.go('album'),
    }, uiIcon('album'), mini, h('span', {}, String(p.rewards.stickers.length)))),
  );
  // long names (Buchstabenblitz) shrink just enough to stay inside their tile;
  // refit once fonts are loaded (fallback metrics differ) and on every resize
  const fit = () => {
    for (const n of root.querySelectorAll('.tile-name')) fitText(n, n.parentElement.clientWidth * 0.92);
  };
  let alive = true;
  const refit = () => { if (alive) fit(); };
  requestAnimationFrame(refit);
  document.fonts?.ready.then(refit);
  addEventListener('resize', refit);
  ctx.speech.speak(hello, { extra: true });
  return () => { alive = false; removeEventListener('resize', refit); };
}
