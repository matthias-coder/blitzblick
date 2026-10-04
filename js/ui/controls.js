import { h } from './dom.js';
import { formatSeconds } from '../util.js';

// switch: the native checkbox stays (keyboard, screen readers, tests) and covers the drawn track invisibly
export const toggle = (label, checked, onChange, testid, disabled = false) => h('label', { class: `toggle${disabled ? ' is-disabled' : ''}` },
  h('span', {}, label),
  h('span', { class: 'switch' },
    h('input', { type: 'checkbox', role: 'switch', checked, disabled, 'data-testid': testid, onChange: (e) => onChange(e.target.checked) }),
    h('span', { class: 'track', 'aria-hidden': 'true' })));

let seq = 0;
export function segmented(label, value, options, onChange, testid) {
  const name = `seg-${++seq}`;
  return h('div', { class: 'field-row seg-row' },
    h('span', { id: `${name}-label` }, label),
    h('div', { class: 'segmented', role: 'radiogroup', 'aria-labelledby': `${name}-label`, 'data-testid': testid, 'data-value': String(value) },
      options.map(([v, text]) => {
        const on = String(v) === String(value);
        return h('label', { class: `seg${on ? ' on' : ''}` },
          h('input', { type: 'radio', name, value: String(v), checked: on, 'data-testid': `${testid}-${v}`, onChange: () => onChange(v) }),
          h('span', {}, text));
      })));
}

export function durationSlider(label, ms, onCommit, testid) {
  const out = h('output', { class: 'unit', 'data-testid': `${testid}-label` }, formatSeconds(ms));
  const input = h('input', {
    type: 'range', min: '100', max: '5000', step: '50', value: String(ms), 'aria-label': label, 'aria-valuetext': formatSeconds(ms), 'data-testid': testid,
    onInput: (e) => { out.textContent = formatSeconds(Number(e.target.value)); e.target.setAttribute('aria-valuetext', out.textContent); },
    onChange: (e) => onCommit(Number(e.target.value)),
  });
  return h('label', { class: 'field-row' }, h('span', {}, label), input, out);
}
