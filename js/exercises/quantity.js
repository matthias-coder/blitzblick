import { randInt, pick } from '../rng.js';
import { layoutPositions } from './quantity-layout.js';
import { buildChoices } from './choices.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';
import { addends, ARITH_DURATION_FACTOR } from './arithmetic.js';

export const id = 'quantity';
export const title = 'Mengen';
export const menuTitle = 'Mengenblitz';
export const OBJECTS = ['apple', 'duck', 'ladybug', 'fish', 'car', 'balloon'];
export const objectUrl = (object) => `assets/objects/${object}.webp`;

// s = with a pattern, m = pattern or scattered, r = scattered, twenty = Zwanzigerfeld
const s = (max) => ({ max, layout: 'structured' });
const m = (max) => ({ max, layout: 'mixed' });
const r = (max) => ({ max, layout: 'random' });
const add = (sum) => ({ add: true, sum });
const twenty = (min, max) => ({ min, max, layout: 'twenty' });

export const LADDERS = {
  pre: [
    { label: 'bis 3 mit Muster', steps: [s(3)] },
    { label: 'bis 5 mit Muster', steps: [s(4), s(5)] },
    { label: 'bis 6, auch durcheinander', steps: [m(5), s(6), m(6)] },
    { label: 'bis 10 mit Muster', steps: [s(8), s(10)] },
  ],
  g1: [
    { label: 'bis 10 mit Muster', steps: [s(6), s(8), s(10)] },
    { label: 'bis 10 durcheinander', steps: [m(8), m(10), r(10)] },
    { label: 'Plus bis 10', steps: [add(5), add(10)] },
    { label: 'bis 20 im Zwanzigerfeld', steps: [twenty(2, 12), twenty(6, 16), twenty(10, 20)] },
  ],
};

export function isAvailable() { return true; }

export function prepareRound(rng) { return { object: pick(rng, OBJECTS), lastPattern: null }; }

export function createTask(step, settings, rng, ctx = { object: OBJECTS[0] }) {
  if (step.add) {
    const { a, b } = addends(rng, step.sum);
    return {
      exercise: id,
      stimulus: {
        add: true, op: '+', a, b, object: ctx.object,
        positionsA: layoutPositions(a, 'structured', rng),
        positionsB: layoutPositions(b, 'structured', rng),
      },
      answer: a + b,
      choices: Array.from({ length: step.sum }, (_, i) => i + 1),
      durationFactor: ARITH_DURATION_FACTOR,
    };
  }
  if (step.layout === 'twenty') {
    const count = randInt(rng, step.min, step.max);
    const pool = Array.from({ length: 20 }, (_, i) => i + 1);
    return {
      exercise: id,
      stimulus: { count, object: ctx.object, positions: layoutPositions(count, 'twenty', rng), twenty: true },
      answer: count,
      choices: buildChoices(count, [count + 1, count - 1, count + 5, count - 5, count + 10, count - 10], pool, 4, rng).sort((x, y) => x - y),
    };
  }
  const count = randInt(rng, 1, step.max);
  const mode = step.layout === 'mixed' ? (rng() < 0.5 ? 'structured' : 'random') : step.layout;
  return {
    exercise: id,
    stimulus: { count, object: ctx.object, positions: layoutPositions(count, mode, rng, ctx) },
    answer: count,
    choices: Array.from({ length: step.max }, (_, i) => i + 1),
  };
}

function field(object, positions, cls = 'field') {
  return h('div', { class: cls }, positions.map((p) => h('img', {
    class: 'obj',
    src: objectUrl(object),
    alt: '',
    style: `left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%`,
  })));
}

export function renderStimulus(task, el) {
  const st = task.stimulus;
  el.replaceChildren(st.add
    ? h('div', { class: 'plus-row', 'data-testid': 'add-stimulus' },
      field(st.object, st.positionsA), h('span', { class: 'plus' }, '+'), field(st.object, st.positionsB))
    : field(st.object, st.positions, st.twenty ? 'field twenty' : 'field'));
}

function dots(n) {
  if (n > 10) return null;
  return h('span', { class: 'dots', 'aria-hidden': 'true' },
    h('span', {}, '•'.repeat(Math.min(n, 5))),
    n > 5 ? h('span', {}, '•'.repeat(n - 5)) : null);
}

export function renderChoices(task, el, onPick) {
  return renderChoiceButtons(el, task.choices, (v) => [h('span', { class: 'num school' }, String(v)), dots(v)], onPick);
}

export function speakPrompt(task) { return task?.stimulus?.add ? 'Wie viele waren es zusammen?' : 'Wie viele waren es?'; }
export function speakSolution(task) {
  const n = task.answer;
  if (task.stimulus?.add) return [`${task.stimulus.a} und ${task.stimulus.b} sind ${n}.`];
  return n === 1 ? ['Es war einer.', 'Das war einer.', 'Nur einer.'] : [`Es waren ${n}.`, `Das waren ${n}.`, `${n} waren es.`];
}
