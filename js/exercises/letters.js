import { pick } from '../rng.js';
import { buildChoices } from './choices.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';

export const id = 'letters';
export const title = 'Buchstaben';
export const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'Ä', 'Ö', 'Ü', 'ß'];

export const NAMES = {
  A: 'A', B: 'Be', C: 'Ce', D: 'De', E: 'E', F: 'Ef', G: 'Ge', H: 'Ha', I: 'I', J: 'Jott',
  K: 'Ka', L: 'El', M: 'Em', N: 'En', O: 'O', P: 'Pe', Q: 'Ku', R: 'Er', S: 'Es', T: 'Te',
  U: 'U', V: 'Vau', W: 'We', X: 'Ix', Y: 'Ypsilon', Z: 'Zett', Ä: 'Ä', Ö: 'Ö', Ü: 'Ü', ß: 'Eszett',
};

export const SOUNDS = {
  A: 'a', B: 'bö', C: 'kö', D: 'dö', E: 'e', F: 'fff', G: 'gö', H: 'hö', I: 'i', J: 'jö',
  K: 'kö', L: 'lll', M: 'mmm', N: 'nnn', O: 'o', P: 'pö', Q: 'kw', R: 'rrr', S: 'sss', T: 'tö',
  U: 'u', V: 'fff', W: 'www', X: 'ks', Y: 'ü', Z: 'ts', Ä: 'ä', Ö: 'ö', Ü: 'ü', ß: 'sss',
};

const CASE_STAGES = { upper: ['upper'], lower: ['lower'], both: ['upper', 'lower', 'mixed'] };
const STAGE_LABELS = { upper: 'Großbuchstaben', lower: 'Kleinbuchstaben', mixed: 'groß und klein gemischt' };
const UPPER_GROUPS = [['M', 'N', 'W'], ['E', 'F'], ['O', 'Q', 'C', 'G'], ['P', 'R', 'B'], ['I', 'L', 'T'], ['U', 'V'], ['A', 'Ä'], ['O', 'Ö'], ['U', 'Ü']];
const LOWER_GROUPS = [['B', 'D', 'P', 'Q'], ['N', 'U', 'H', 'M'], ['I', 'L', 'J'], ['A', 'O', 'E'], ['V', 'W'], ['A', 'Ä'], ['O', 'Ö'], ['U', 'Ü'], ['S', 'ß']];

const display = (base, c) => (c === 'lower' ? base.toLowerCase() : base);
const knownLetters = (settings) => LETTERS.filter((l) => settings.letters.known.includes(l));

export function isAvailable(settings) { return knownLetters(settings).length >= 2; }
export function stages(settings) { return CASE_STAGES[settings.letters.case] ?? CASE_STAGES.upper; }
export function maxComplexity(settings) { return stages(settings).length - 1; }
export function startComplexity() { return 0; }
export function describeLevel(complexity, settings) {
  const s = stages(settings);
  return STAGE_LABELS[s[Math.min(complexity, s.length - 1)]];
}

export function createTask(level, settings, rng) {
  const known = knownLetters(settings);
  if (known.length === 0) throw new Error('no known letters');
  const s = stages(settings);
  const stage = s[Math.min(level.complexity, s.length - 1)];
  const c = stage === 'mixed' ? (rng() < 0.5 ? 'upper' : 'lower') : stage;
  const base = pick(rng, known);
  const groups = c === 'upper' ? UPPER_GROUPS : LOWER_GROUPS;
  const preferred = groups.filter((g) => g.includes(base)).flat();
  const bases = buildChoices(base, preferred, known, 4, rng);
  return {
    exercise: id,
    stimulus: { text: display(base, c) },
    base,
    answer: display(base, c),
    choices: bases.map((b) => display(b, c)),
  };
}

export function renderStimulus(task, el) {
  el.replaceChildren(h('div', { class: 'flash-text' }, task.stimulus.text));
}

export function renderChoices(task, el, onPick) {
  return renderChoiceButtons(el, task.choices, (v) => h('span', { class: 'glyph' }, v), onPick);
}

export function speakPrompt() { return 'Welcher Buchstabe war das?'; }
export function speakSolution(task, settings) {
  return settings.letters.speak === 'name' ? `Das war ein ${NAMES[task.base]}.` : `Das war ${SOUNDS[task.base]}.`;
}
