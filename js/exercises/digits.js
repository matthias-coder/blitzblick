import { randInt } from '../rng.js';
import { buildChoices } from './choices.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';
import { addends, minusPair, ARITH_DURATION_FACTOR, MINUS_SIGN } from './arithmetic.js';

export const id = 'digits';
export const title = 'Zahlen';
export const menuTitle = 'Zahlenblitz';
const CONFUSIONS = { 1: [7], 7: [1], 6: [9], 9: [6], 3: [8], 8: [3], 2: [5], 5: [2] };

const range = (lo, hi) => ({ lo, hi });
const add = (sum) => ({ add: true, sum });

export const LADDERS = {
  pre: [
    { label: 'Zahlen 1–3', steps: [range(1, 3)] },
    { label: 'Zahlen 1–5', steps: [range(1, 5)] },
    { label: 'Zahlen 0–9', steps: [range(0, 9)] },
    { label: 'Zahlen 0–10', steps: [range(0, 10)] },
  ],
  g1: [
    { label: 'Zahlen 0–10', steps: [range(0, 10)] },
    { label: 'Zahlen 0–20', steps: [range(0, 20)] },
    { label: 'Plus bis 10', steps: [add(5), add(10)] },
    { label: 'Plus und Minus bis 10', steps: [{ mix: true, max: 10 }] },
  ],
};

export function isAvailable() { return true; }

function arithmetic(rng, op, a, b, max) {
  const answer = op === '+' ? a + b : a - b;
  const pool = Array.from({ length: max + 1 }, (_, i) => i);
  return {
    exercise: id,
    stimulus: { add: true, op, a, b, text: `${a} ${op === '+' ? '+' : MINUS_SIGN} ${b}` },
    answer,
    choices: buildChoices(answer, [answer + 1, answer - 1, a, b, answer + 2, answer - 2], pool, 4, rng),
    durationFactor: ARITH_DURATION_FACTOR,
  };
}

export function createTask(step, settings, rng) {
  if (step.add) {
    const { a, b } = addends(rng, step.sum);
    return arithmetic(rng, '+', a, b, step.sum);
  }
  if (step.mix) {
    if (rng() < 0.5) {
      const { a, b } = addends(rng, step.max);
      return arithmetic(rng, '+', a, b, step.max);
    }
    const { a, b } = minusPair(rng, step.max);
    return arithmetic(rng, '-', a, b, step.max);
  }
  const answer = randInt(rng, step.lo, step.hi);
  const pool = Array.from({ length: step.hi - step.lo + 1 }, (_, i) => step.lo + i);
  const preferred = [...(CONFUSIONS[answer] ?? [])];
  if (answer >= 10) preferred.push(Number(String(answer).split('').reverse().join('')));
  preferred.push(answer + 1, answer - 1, answer + 2, answer - 2);
  return {
    exercise: id,
    stimulus: { text: String(answer) },
    answer,
    choices: buildChoices(answer, preferred, pool, 4, rng),
  };
}

export function renderStimulus(task, el) {
  el.replaceChildren(h('div', { class: task.stimulus.add ? 'flash-text school sum' : 'flash-text school' }, task.stimulus.text));
}

// wrong answer on a sum: the whole equation, e.g. "9 – 5 = 4"
export function renderSolution(task, el) {
  if (!task.stimulus.add) { renderStimulus(task, el); return; }
  el.replaceChildren(h('div', { class: 'flash-text school sum equation', 'data-testid': 'equation', 'aria-label': `${task.stimulus.a} ${task.stimulus.op === '+' ? 'plus' : 'minus'} ${task.stimulus.b} ist ${task.answer}` }, `${task.stimulus.text} = ${task.answer}`));
}

export function renderChoices(task, el, onPick) {
  return renderChoiceButtons(el, task.choices, (v) => h('span', { class: 'glyph school' }, String(v)), onPick);
}

export function speakPrompt(task) {
  if (!task?.stimulus?.add) return 'Welche Zahl war das?';
  return task.stimulus.op === '-' ? 'Wie viel ist das?' : 'Wie viel ist das zusammen?';
}
export function speakSolution(task) {
  const st = task.stimulus;
  if (st?.add) return [`${st.a} ${st.op === '-' ? 'minus' : 'plus'} ${st.b} ist ${task.answer}.`];
  return [`Das war die ${task.answer}.`, `Es war die ${task.answer}.`, `Das war eine ${task.answer}.`];
}
