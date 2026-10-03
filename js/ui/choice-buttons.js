import { h } from './dom.js';

export function renderChoiceButtons(el, choices, label, onPick) {
  let done = false;
  const buttons = choices.map((value) => {
    const btn = h('button', { class: 'choice', type: 'button', 'data-value': String(value) }, label(value));
    btn.addEventListener('click', () => {
      if (done) return;
      done = true;
      buttons.forEach((b) => { b.disabled = true; });
      onPick(value, btn);
    });
    return btn;
  });
  el.replaceChildren(h('div', { class: `choices cols-${Math.min(choices.length, 5)}` }, buttons));
  return buttons;
}
