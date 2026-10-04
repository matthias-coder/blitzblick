import { pick } from '../rng.js';
import { buildChoices } from './choices.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';
import { lineatur } from '../ui/lineatur.js';

export const id = 'letters';
export const title = 'Buchstaben';
export const menuTitle = 'Buchstabenblitz';
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

const UPPER_GROUPS = [['M', 'N', 'W'], ['E', 'F'], ['O', 'Q', 'C', 'G'], ['P', 'R', 'B'], ['I', 'L', 'T'], ['U', 'V'], ['A', 'Ä'], ['O', 'Ö'], ['U', 'Ü']];
const LOWER_GROUPS = [['B', 'D', 'P', 'Q'], ['N', 'U', 'H', 'M'], ['I', 'L', 'J'], ['A', 'O', 'E'], ['V', 'W'], ['A', 'Ä'], ['O', 'Ö'], ['U', 'Ü'], ['S', 'ß']];

// similar: distractors prefer look-alike letters (M/N/W …); otherwise they are random known letters
const st = (c, choices, similar = true) => ({ case: c, choices, similar });

export const LADDERS = {
  pre: [
    { label: 'Großbuchstaben, 3 Antworten', steps: [st('upper', 3, false)] },
    { label: 'Großbuchstaben, 4 Antworten', steps: [st('upper', 4, false)] },
    { label: 'Großbuchstaben, ähnliche zur Auswahl', steps: [st('upper', 4)] },
    { label: 'Kleinbuchstaben', steps: [st('lower', 4)] },
  ],
  g1: [
    { label: 'Großbuchstaben', steps: [st('upper', 4)] },
    { label: 'Kleinbuchstaben', steps: [st('lower', 4)] },
    { label: 'groß und klein gemischt', steps: [st('mixed', 4)] },
    { label: 'gemischt, 6 Antworten', steps: [st('mixed', 6)] },
  ],
};

const display = (base, c) => (c === 'lower' ? base.toLowerCase() : base);
const knownLetters = (settings) => LETTERS.filter((l) => settings.letters.known.includes(l));

export function isAvailable(settings) { return knownLetters(settings).length >= 2; }
// six answers only make sense with at least four known letters
export function levelAvailable(level, settings) {
  return level.steps.every((s) => s.choices <= 4 || knownLetters(settings).length >= 4);
}

export function createTask(step, settings, rng) {
  const known = knownLetters(settings);
  if (known.length === 0) throw new Error('no known letters');
  const c = step.case === 'mixed' ? (rng() < 0.5 ? 'upper' : 'lower') : step.case;
  const base = pick(rng, known);
  const groups = c === 'upper' ? UPPER_GROUPS : LOWER_GROUPS;
  const preferred = step.similar ? groups.filter((g) => g.includes(base)).flat() : [];
  const bases = buildChoices(base, preferred, known, step.choices, rng);
  return {
    exercise: id,
    stimulus: { text: display(base, c) },
    base,
    answer: display(base, c),
    choices: bases.map((b) => display(b, c)),
    lineature: settings.letters.lineature !== false,
  };
}

export function renderStimulus(task, el) {
  el.replaceChildren(task.lineature
    ? h('div', { class: 'flash-lineature' }, lineatur(task.stimulus.text))
    : h('div', { class: 'flash-text school' }, task.stimulus.text));
}

export function renderChoices(task, el, onPick) {
  return renderChoiceButtons(el, task.choices, (v) => h('span', { class: 'glyph school' }, v), onPick);
}

export function speakPrompt() { return 'Welcher Buchstabe war das?'; }
export function speakSolution(task, settings) {
  if (settings.letters.speak === 'name') {
    const n = NAMES[task.base];
    return [`Das war ein ${n}.`, `Es war ein ${n}.`, `Das war das ${n}.`];
  }
  const s = SOUNDS[task.base];
  return [`Das war ${s}.`, `Es war ${s}.`, `Der Laut war ${s}.`];
}
