import { h } from './dom.js';
import { EXERCISES, EXERCISE_ORDER } from '../exercises/index.js';
import { iconBtn, starBadge, avatarImg, uiIcon } from './widgets.js';
import { attachLongPress } from './gate.js';

const TILE_CONTENT = {
  quantity: () => h('span', { class: 'tile-apples' }, [0, 1, 2].map(() => h('img', { src: 'assets/objects/apple.svg', alt: '' }))),
  digits: () => '1 2 3',
  letters: () => 'A B C',
  syllables: () => h('span', { class: 'tile-syl' }, h('span', {}, 'Ma'), h('span', {}, 'ma')),
};

export function render(root, ctx) {
  const p = ctx.profile;
  const ids = EXERCISE_ORDER.filter((id) => p.settings.exercises[id] && EXERCISES[id].isAvailable(p.settings));
  const gear = iconBtn('gear', 'Elternbereich: 3 Sekunden gedrückt halten', null, 'gear');
  gear.classList.add('gear');
  attachLongPress(gear, 3000, () => ctx.go('parents'));
  const who = ctx.state.profiles.length > 1
    ? h('button', { class: 'icon-btn', 'data-testid': 'switch-profile', 'aria-label': 'Profil wechseln', onClick: () => ctx.go('profiles') }, avatarImg(p.avatar))
    : h('div', { class: 'icon-btn' }, avatarImg(p.avatar));
  root.append(
    h('header', { class: 'topbar' }, who, h('div', { class: 'spacer' }), starBadge(p.rewards.stars), gear),
    h('main', { class: 'menu' }, ids.map((id) => h('button', {
      class: `tile tile-${id}`,
      'data-testid': `tile-${id}`,
      'aria-label': EXERCISES[id].title,
      onClick: () => ctx.go('round', { exerciseId: id }),
    }, TILE_CONTENT[id]()))),
    h('footer', { class: 'menu-foot' }, h('button', {
      class: 'album-btn', 'data-testid': 'open-album', 'aria-label': 'Sammelalbum', onClick: () => ctx.go('album'),
    }, uiIcon('album'), h('span', {}, String(p.rewards.stickers.length)))),
    h('img', { class: 'mascot', src: 'assets/mascot/robot-wave.png', alt: '' }),
  );
  ctx.speech.speak(`Hallo ${p.name}! Was möchtest du üben?`, { extra: true });
}
