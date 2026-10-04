import { h } from './dom.js';

export const uiIcon = (name) => h('img', { src: `assets/ui/${name}.svg`, alt: '' });

export function iconBtn(name, label, onClick, testid) {
  return h('button', { class: 'icon-btn candy candy-round', type: 'button', 'aria-label': label, 'data-testid': testid, onClick }, uiIcon(name));
}

export function starBadge(stars) {
  return h('div', { class: 'star-badge', 'data-testid': 'star-badge' }, uiIcon('star'), String(stars));
}

export function avatarImg(avatar) {
  return h('img', { class: 'avatar', src: `assets/avatars/${avatar}.webp`, alt: '' });
}
