import { h } from './dom.js';
import { uiIcon } from './widgets.js';

// "Zurück" mid-round: a big "Weiter" (default) and a small "Beenden"; Escape keeps playing
export function confirmLeave(root, { onStay, onLeave }) {
  const stay = h('button', { type: 'button', class: 'candy candy-pill is-go leave-stay', 'data-testid': 'leave-stay' },
    uiIcon('play'), h('span', {}, 'Weiter'));
  const quit = h('button', { type: 'button', class: 'candy candy-pill leave-quit', 'data-testid': 'leave-quit' },
    uiIcon('home'), h('span', {}, 'Beenden'));
  const dialog = h('div', { class: 'leave-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'leave-title', 'data-testid': 'leave-dialog' },
    h('div', { class: 'leave-card' },
      h('img', { class: 'leave-robot', src: 'assets/mascot/robot-wave.webp', alt: '' }),
      h('p', { class: 'bubble bubble-up', id: 'leave-title' }, 'Weiter üben?'),
      stay,
      quit));
  function close() {
    document.removeEventListener('keydown', onKey, true);
    dialog.remove();
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      onStay();
    } else if (e.key === 'Tab') {
      // two buttons: keep the focus inside the dialog
      e.preventDefault();
      (document.activeElement === stay ? quit : stay).focus();
    }
  }
  stay.addEventListener('click', () => { close(); onStay(); });
  quit.addEventListener('click', () => { close(); onLeave(); });
  document.addEventListener('keydown', onKey, true);
  root.append(dialog);
  stay.focus();
  return close;
}
