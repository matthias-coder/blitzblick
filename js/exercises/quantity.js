import { randInt, pick } from '../rng.js';
import { ALL_PAGES, stickerId, stickerUrl } from '../rewards.js';
import { layoutPositions } from './quantity-layout.js';
import { buildChoices } from './choices.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';
import { addends, ARITH_DURATION_FACTOR } from './arithmetic.js';
import { createCompareTask, COMPARE_SHARE, MAX_COMPARE_PER_ROUND } from './compare.js';

export const id = 'quantity';
export const title = 'Mengen';
export const menuTitle = 'Mengenblitz';
export const BASE_OBJECTS = ['apple', 'duck', 'ladybug', 'fish', 'car', 'balloon'];
// album stickers that also work as counting objects: listed pages only (new pages are opt-in, Quatschwesen stay album-only),
// minus motifs that show several things, carry countable dots/digits or get too thin at counting size
const COUNT_PAGES = ['fruit', 'veggies', 'treats', 'food', 'toys', 'vehicles', 'space', 'blockworld', 'animals', 'sea', 'dinos', 'room', 'kitchen', 'cooking', 'magic', 'garden', 'construction', 'bugs'];
const NOT_COUNTABLE = new Set([
  'fruit/cherry', 'treats/grapes', 'room/pencils', 'room/flowers', 'room/sneakers', 'magic/crystals', 'blockworld/crystal',
  'toys/blocks', 'kitchen/salad', 'kitchen/cereal', 'food/spaghetti',
  'blockworld/sixtyseven', 'food/birthdaycake', 'food/pizza', 'veggies/toadstool', 'dinos/egg', 'dinos/footprint',
  'kitchen/spatula', 'kitchen/whisk', 'cooking/ladle', 'magic/wand', 'magic/broom', 'magic/telescope', 'sea/jellyfish', 'vehicles/bike', 'cooking/pan', 'garden/tulips',
]);
export const STICKER_OBJECTS = COUNT_PAGES
  .flatMap((id) => ALL_PAGES.find((p) => p.id === id).stickers.map((s) => stickerId(id, s)))
  .filter((o) => !NOT_COUNTABLE.has(o));
export const OBJECTS = [...BASE_OBJECTS, ...STICKER_OBJECTS];
export const objectUrl = (object) => (object.includes('/') ? stickerUrl(object) : `assets/objects/${object}.webp`);

// s = with a pattern, m = pattern or scattered, r = scattered, twenty = Zwanzigerfeld
const s = (max) => ({ max, layout: 'structured' });
const m = (max) => ({ max, layout: 'mixed' });
const r = (max) => ({ max, layout: 'random' });
const add = (sum) => ({ add: true, sum });
const twenty = (min, max) => ({ min, max, layout: 'twenty' });
// "Wo ist mehr?" mixed into a level: counts up to max, at least minDiff apart; equal adds "gleich viel", area enlarges the smaller group
const cmp = (max, minDiff, extra = {}) => ({ max, minDiff, ...extra });

export const LADDERS = {
  pre: [
    { label: 'bis 3 mit Muster', steps: [s(3)] },
    { label: 'bis 5 mit Muster', steps: [s(4), s(5)], compare: cmp(6, 3) },
    { label: 'bis 6, auch durcheinander', steps: [m(5), s(6), m(6)], compare: cmp(10, 2) },
    { label: 'bis 10 mit Muster', steps: [s(8), s(10)], compare: cmp(10, 1, { equal: true }) },
  ],
  g1: [
    { label: 'bis 10 mit Muster', steps: [s(6), s(8), s(10)], compare: cmp(10, 2) },
    { label: 'bis 10 durcheinander', steps: [m(8), m(10), r(10)], compare: cmp(10, 1, { equal: true }) },
    { label: 'Plus bis 10', steps: [add(5), add(10)] },
    { label: 'bis 20 im Zwanzigerfeld', steps: [twenty(2, 12), twenty(6, 16), twenty(10, 20)], compare: cmp(10, 1, { equal: true, area: true }) },
  ],
};

export function isAvailable() { return true; }

export function prepareRound(rng, levelDef) {
  return { object: pick(rng, OBJECTS), lastPattern: null, compare: levelDef?.compare ?? null, compareCount: 0 };
}

export function createTask(step, settings, rng, ctx = { object: OBJECTS[0] }) {
  if (ctx.compare && settings.quantity?.compare !== false
    && (ctx.compareCount ?? 0) < MAX_COMPARE_PER_ROUND && rng() < COMPARE_SHARE) {
    ctx.compareCount = (ctx.compareCount ?? 0) + 1;
    return createCompareTask(rng, ctx.compare, OBJECTS, ctx.object);
  }
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

function field(object, positions, cls = 'field', scale = 1) {
  return h('div', { class: cls, style: `--obj-scale:${scale}` }, positions.map((p) => h('img', {
    class: 'obj',
    src: objectUrl(object),
    alt: '',
    style: `left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%`,
  })));
}

export function renderStimulus(task, el) {
  const st = task.stimulus;
  if (st.compare) {
    el.replaceChildren(h('div', { class: 'compare-row', 'data-testid': 'compare-stimulus' },
      field(st.objectLeft, st.positionsLeft, 'field', st.scaleLeft),
      field(st.objectRight, st.positionsRight, 'field', st.scaleRight)));
    return;
  }
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

const SIDE_LABEL = { left: 'links', right: 'rechts' };

export function renderChoices(task, el, onPick) {
  if (task.stimulus?.compare) {
    return renderChoiceButtons(el, task.choices, (v) => (v === 'equal'
      ? h('span', { class: 'num' }, '=')
      : h('span', { class: 'compare-pick', title: SIDE_LABEL[v] })), onPick);
  }
  return renderChoiceButtons(el, task.choices, (v) => [h('span', { class: 'num school' }, String(v)), dots(v)], onPick);
}

export function speakPrompt(task) {
  if (task?.stimulus?.compare) return 'Wo waren mehr?';
  return task?.stimulus?.add ? 'Wie viele waren es zusammen?' : 'Wie viele waren es?';
}

export function speakSolution(task) {
  const st = task.stimulus;
  if (st?.compare) {
    if (task.answer === 'equal') return ['Es waren gleich viele.'];
    const big = Math.max(st.left, st.right);
    const small = Math.min(st.left, st.right);
    return [`${task.answer === 'left' ? 'Links' : 'Rechts'} waren mehr: ${big} gegen ${small}.`];
  }
  const n = task.answer;
  if (st?.add) return [`${st.a} und ${st.b} sind ${n}.`];
  return n === 1 ? ['Es war einer.', 'Das war einer.', 'Nur einer.'] : [`Es waren ${n}.`, `Das waren ${n}.`, `${n} waren es.`];
}
