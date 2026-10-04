import { h } from './dom.js';
import { avatarImg } from './widgets.js';
import { AVATARS, AVATAR_LABELS, createProfile, addProfile, setActive } from '../profiles.js';

function renderCreate(root, ctx) {
  let avatar = AVATARS[0];
  const name = h('input', { id: 'profile-name', type: 'text', maxlength: '20', autocomplete: 'off', placeholder: 'Name des Kindes' });
  const pick = h('div', { class: 'avatar-pick' }, AVATARS.map((a) => h('button', {
    type: 'button',
    class: `avatar-opt${a === avatar ? ' selected' : ''}`,
    'data-testid': `avatar-${a}`,
    'aria-label': AVATAR_LABELS[a],
    onClick: (e) => {
      avatar = a;
      [...pick.children].forEach((b) => b.classList.toggle('selected', b === e.currentTarget));
    },
  }, avatarImg(a))));
  const msg = h('p', { class: 'form-msg' });
  const form = h('form', {
    class: 'card welcome',
    onSubmit: (e) => {
      e.preventDefault();
      if (!name.value.trim()) { msg.textContent = 'Bitte einen Namen eingeben.'; return; }
      ctx.setState(addProfile(ctx.state, createProfile({ name: name.value, avatar })));
      ctx.go('menu');
    },
  },
  h('h1', {}, 'Willkommen bei Blitzblick'),
  h('p', {}, 'Lege ein Profil für dein Kind an. Weitere Einstellungen findest du später im Elternbereich: Zahnrad oben rechts 3 Sekunden gedrückt halten.'),
  h('label', { for: 'profile-name' }, 'Name'), name,
  h('div', { class: 'label' }, 'Bild'), pick,
  msg,
  h('button', { class: 'primary-btn', type: 'submit', 'data-testid': 'create-profile' }, 'Profil anlegen'));
  root.append(h('main', { class: 'center' }, form));
}

export function render(root, ctx) {
  const { profiles } = ctx.state;
  if (!profiles.length) return renderCreate(root, ctx);
  root.append(h('main', { class: 'profile-picker' }, profiles.map((p) => h('button', {
    class: 'profile-card',
    'data-testid': `profile-${p.id}`,
    onClick: () => { ctx.setState(setActive(ctx.state, p.id)); ctx.go('menu'); },
  }, avatarImg(p.avatar), h('span', {}, p.name)))));
  ctx.speech.speak('Wer bist du?', { extra: true });
}
