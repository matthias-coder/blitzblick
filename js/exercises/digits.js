import { randInt } from '../rng.js';
import { buildChoices } from './choices.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';
import { addends, addStages, addLabel, ADD_DURATION_FACTOR } from './addition.js';

export const id = 'digits';
export const title = 'Zahlen';
const STAGES = [5, 9, 10, 20];
const CONFUSIONS = { 1: [7], 7: [1], 6: [9], 9: [6], 3: [8], 8: [3], 2: [5], 5: [2] };

export function isAvailable() { return true; }
const regularStages = (settings) => STAGES.filter((r) => r <= settings.digits.range);
export function stages(settings) { return [...regularStages(settings), ...addStages(settings.digits.addition)]; }
export function maxComplexity(settings) { return stages(settings).length - 1; }
export function fixedComplexity(settings) { return regularStages(settings).length - 1; }
export function startComplexity() { return 0; }
export function describeLevel(complexity, settings) {
  const s = stages(settings);
  const st = s[Math.min(complexity, s.length - 1)];
  return st.add ? addLabel(st.sum) : `Zahlen 0–${st}`;
}

export function createTask(level, settings, rng) {
  const s = stages(settings);
  const st = s[Math.min(level.complexity, s.length - 1)];
  if (st.add) {
    const { a, b } = addends(rng, st.sum);
    const answer = a + b;
    const pool = Array.from({ length: st.sum + 1 }, (_, i) => i);
    return {
      exercise: id,
      stimulus: { add: true, a, b, text: `${a} + ${b}` },
      answer,
      choices: buildChoices(answer, [answer + 1, answer - 1, a, b, answer + 2, answer - 2], pool, 4, rng),
      durationFactor: ADD_DURATION_FACTOR,
    };
  }
  const hi = st;
  const answer = randInt(rng, 0, hi);
  const pool = Array.from({ length: hi + 1 }, (_, i) => i);
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
  el.replaceChildren(h('div', { class: task.stimulus.add ? 'flash-text sum' : 'flash-text' }, task.stimulus.text));
}

export function renderChoices(task, el, onPick) {
  return renderChoiceButtons(el, task.choices, (v) => h('span', { class: 'glyph' }, String(v)), onPick);
}

export function speakPrompt(task) { return task?.stimulus?.add ? 'Wie viel ist das zusammen?' : 'Welche Zahl war das?'; }
export function speakSolution(task) {
  if (task.stimulus?.add) return [`${task.stimulus.a} plus ${task.stimulus.b} ist ${task.answer}.`];
  return [`Das war die ${task.answer}.`, `Es war die ${task.answer}.`, `Das war eine ${task.answer}.`];
}
