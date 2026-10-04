import { randInt, pick } from '../rng.js';
import { layoutPositions } from './quantity-layout.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';
import { addends, addStages, addLabel, ADD_DURATION_FACTOR } from './addition.js';

export const id = 'quantity';
export const title = 'Mengen';
export const OBJECTS = ['apple', 'duck', 'ladybug', 'fish', 'car', 'balloon'];
export const objectUrl = (object) => `assets/objects/${object}.webp`;
export const MAXES = [3, 4, 5, 6, 8, 10];
const LAYOUT_LABELS = { structured: 'strukturiert', random: 'zufällig', mixed: 'gemischt' };

export function isAvailable() { return true; }

function regularStages(settings) {
  const maxes = MAXES.filter((m) => m <= settings.quantity.max);
  const list = maxes.length ? maxes : [3];
  const layout = settings.quantity.layout;
  if (layout === 'structured' || layout === 'random') return list.map((max) => ({ max, layout }));
  return list.flatMap((max) => [{ max, layout: 'structured' }, { max, layout: 'mixed' }]);
}

export function stages(settings) {
  return [...regularStages(settings), ...addStages(settings.quantity.addition, settings.quantity.max)];
}

export function maxComplexity(settings) { return stages(settings).length - 1; }
export function fixedComplexity(settings) { return regularStages(settings).length - 1; }

export function startComplexity(settings) {
  const s = stages(settings);
  const i = s.findIndex((st) => st.max === 5);
  return i >= 0 ? i : s.length - 1;
}

export function describeLevel(complexity, settings) {
  const s = stages(settings);
  const st = s[Math.min(complexity, s.length - 1)];
  if (st.add) return addLabel(st.sum);
  return `bis ${st.max}, ${LAYOUT_LABELS[st.layout]}`;
}

export function prepareRound(rng) { return { object: pick(rng, OBJECTS) }; }

export function createTask(level, settings, rng, roundCtx = { object: OBJECTS[0] }) {
  const s = stages(settings);
  const st = s[Math.min(level.complexity, s.length - 1)];
  if (st.add) {
    const { a, b } = addends(rng, st.sum);
    return {
      exercise: id,
      stimulus: {
        add: true, a, b, object: roundCtx.object,
        positionsA: layoutPositions(a, 'structured', rng),
        positionsB: layoutPositions(b, 'structured', rng),
      },
      answer: a + b,
      choices: Array.from({ length: st.sum }, (_, i) => i + 1),
      durationFactor: ADD_DURATION_FACTOR,
    };
  }
  const count = randInt(rng, 1, st.max);
  const mode = st.layout === 'mixed' ? (rng() < 0.5 ? 'structured' : 'random') : st.layout;
  return {
    exercise: id,
    stimulus: { count, object: roundCtx.object, positions: layoutPositions(count, mode, rng) },
    answer: count,
    choices: Array.from({ length: st.max }, (_, i) => i + 1),
  };
}

function field(object, positions) {
  return h('div', { class: 'field' }, positions.map((p) => h('img', {
    class: 'obj',
    src: objectUrl(object),
    alt: '',
    style: `left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%`,
  })));
}

export function renderStimulus(task, el) {
  const s = task.stimulus;
  el.replaceChildren(s.add
    ? h('div', { class: 'add-row', 'data-testid': 'add-stimulus' },
      field(s.object, s.positionsA), h('span', { class: 'plus' }, '+'), field(s.object, s.positionsB))
    : field(s.object, s.positions));
}

function dots(n) {
  return h('span', { class: 'dots', 'aria-hidden': 'true' },
    h('span', {}, '•'.repeat(Math.min(n, 5))),
    n > 5 ? h('span', {}, '•'.repeat(n - 5)) : null);
}

export function renderChoices(task, el, onPick) {
  return renderChoiceButtons(el, task.choices, (v) => [h('span', { class: 'num' }, String(v)), dots(v)], onPick);
}

export function speakPrompt(task) { return task?.stimulus?.add ? 'Wie viele waren es zusammen?' : 'Wie viele waren es?'; }
export function speakSolution(task) {
  const n = task.answer;
  if (task.stimulus?.add) return [`${task.stimulus.a} und ${task.stimulus.b} sind ${n}.`];
  return n === 1 ? ['Es war einer.', 'Das war einer.', 'Nur einer.'] : [`Es waren ${n}.`, `Das waren ${n}.`, `${n} waren es.`];
}
