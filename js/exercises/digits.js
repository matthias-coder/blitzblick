import { randInt } from '../rng.js';
import { buildChoices } from './choices.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';

export const id = 'digits';
export const title = 'Zahlen';
const STAGES = [5, 9, 10, 20];
const CONFUSIONS = { 1: [7], 7: [1], 6: [9], 9: [6], 3: [8], 8: [3], 2: [5], 5: [2] };

export function isAvailable() { return true; }
export function stages(settings) { return STAGES.filter((r) => r <= settings.digits.range); }
export function maxComplexity(settings) { return stages(settings).length - 1; }
export function startComplexity() { return 0; }
export function describeLevel(complexity, settings) {
  const s = stages(settings);
  return `Zahlen 0–${s[Math.min(complexity, s.length - 1)]}`;
}

export function createTask(level, settings, rng) {
  const s = stages(settings);
  const hi = s[Math.min(level.complexity, s.length - 1)];
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
  el.replaceChildren(h('div', { class: 'flash-text' }, task.stimulus.text));
}

export function renderChoices(task, el, onPick) {
  return renderChoiceButtons(el, task.choices, (v) => h('span', { class: 'glyph' }, String(v)), onPick);
}

export function speakPrompt() { return 'Welche Zahl war das?'; }
export function speakSolution(task) { return `Das war die ${task.answer}.`; }
