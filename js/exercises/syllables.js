import { pick, shuffle } from '../rng.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';
import { LETTERS } from './letters.js';
import { buildPool, syllabify, letterKey, applyCase, VOWELS } from './words.js';

export const id = 'syllables';
export const title = 'Silben & Wörter';
export const menuTitle = 'Silbenblitz';
const SIMILAR = [['M', 'N', 'W'], ['E', 'F'], ['O', 'Q', 'C', 'G'], ['P', 'R', 'B'], ['I', 'L', 'T'], ['U', 'V'],
  ['B', 'D', 'P', 'Q'], ['N', 'U', 'H', 'M'], ['I', 'L', 'J'], ['A', 'O', 'E'], ['A', 'Ä'], ['O', 'Ö'], ['U', 'Ü'], ['S', 'ß']];

// kinds: syllable = generated syllables, open = words of two open syllables, all = every word
const st = (kind, choices, colors = true) => ({ kind, choices, colors });

export const LADDERS = {
  pre: [
    { label: 'Silben, 3 Antworten', steps: [st('syllable', 3)] },
    { label: 'Silben, 4 Antworten', steps: [st('syllable', 4)] },
    { label: 'Wörter aus zwei offenen Silben', steps: [st('open', 4)] },
    { label: 'dieselben Wörter ohne Farbhilfe', steps: [st('open', 4, false)] },
  ],
  g1: [
    { label: 'Silben', steps: [st('syllable', 4)] },
    { label: 'Wörter aus zwei offenen Silben', steps: [st('open', 4)] },
    { label: 'alle Wörter', steps: [st('all', 4)] },
    { label: 'alle Wörter ohne Farbhilfe', steps: [st('all', 4, false)] },
  ],
};

const knownKeys = (settings) => LETTERS.filter((l) => settings.letters.known.includes(l));
const KIND_LEVELS = { syllable: [0], open: [1], all: [1, 2] };
export const candidatesFor = (pool, kind) => pool.filter((e) => KIND_LEVELS[kind].includes(e.level));

export function isAvailable(settings) { return buildPool(settings).length >= 4; }
export function levelAvailable(level, settings) {
  const pool = buildPool(settings);
  return pool.length >= 4 && level.steps.every((s) => candidatesFor(pool, s.kind).length >= 3);
}
export function prepareRound() { return { last: null }; }

function variants(answer, keys) {
  const chars = [...answer];
  const swaps = [];
  for (let i = 0; i < chars.length - 1; i++) {
    if (letterKey(chars[i]) === letterKey(chars[i + 1])) continue;
    const c = [...chars];
    [c[i], c[i + 1]] = [c[i + 1], c[i]];
    swaps.push(applyCase(c, chars));
  }
  const replacements = [];
  chars.forEach((ch, i) => {
    const k = letterKey(ch);
    const similar = SIMILAR.filter((g) => g.includes(k)).flat().filter((x) => x !== k && keys.includes(x));
    const sameType = keys.filter((x) => x !== k && VOWELS.includes(x) === VOWELS.includes(k));
    for (const r of new Set(similar.length ? similar : sameType)) {
      const c = [...chars];
      c[i] = r;
      replacements.push(applyCase(c, chars));
    }
  });
  return { swaps, replacements };
}

export function buildDistractors(answer, pool, keys, rng, count = 3) {
  const len = [...answer].length;
  const out = [];
  const chars = [...answer];
  // a capital letter is never swapped for ß ("ßofa")
  const badEszett = (t) => [...t].some((c, i) => c === 'ß' && chars[i] !== undefined && chars[i] !== 'ß' && chars[i] === chars[i].toUpperCase() && chars[i] !== chars[i].toLowerCase());
  const add = (t) => {
    if (out.length < count && t && t !== answer && !badEszett(t) && !out.includes(t) && [...t].every((c) => keys.includes(letterKey(c)))) out.push(t);
  };
  const { swaps, replacements } = variants(answer, keys);
  const s = shuffle(rng, swaps);
  const r = shuffle(rng, replacements);
  const near = shuffle(rng, pool.map((e) => e.text).filter((t) => Math.abs([...t].length - len) <= 1));
  add(s[0]);
  add(r[0]);
  [...r.slice(1), ...s.slice(1), ...near].forEach(add);
  // last resort for tiny alphabets: random strings of known letters with the answer's casing
  for (let i = 0; out.length < count && i < 500; i++) add(applyCase(Array.from({ length: len }, () => pick(rng, keys)), [...answer]));
  return out;
}

// real words keep their stored split; made-up variants of the same length copy the answer's cuts
function partsFor(text, pool, answer) {
  const real = pool.find((e) => e.text === text);
  if (real) return real.parts;
  const chars = [...text];
  if (chars.length !== [...answer.text].length) return syllabify(text);
  let i = 0;
  return answer.parts.map((p) => chars.slice(i, (i += [...p].length)).join(''));
}

export function createTask(step, settings, rng, ctx = { last: null }) {
  const pool = buildPool(settings);
  if (pool.length === 0) throw new Error('no playable syllables or words');
  const own = candidatesFor(pool, step.kind);
  const cands = own.length ? own : pool;
  let entry = pick(rng, cands);
  if (entry.text === ctx.last && cands.length > 1) entry = pick(rng, cands.filter((e) => e.text !== ctx.last));
  ctx.last = entry.text;
  const choices = shuffle(rng, [entry.text, ...buildDistractors(entry.text, pool, knownKeys(settings), rng, step.choices - 1)]);
  return {
    exercise: id,
    stimulus: { text: entry.text, parts: entry.parts },
    answer: entry.text,
    choices,
    parts: Object.fromEntries(choices.map((c) => [c, partsFor(c, pool, entry)])),
    kind: entry.level === 0 ? 'syllable' : 'word',
    colors: settings.syllables?.colors !== false && step.colors !== false,
  };
}

function wordEl(tag, cls, text, parts, colors) {
  const content = colors ? parts.map((p, i) => h('span', { class: i % 2 ? 'syl-b' : 'syl-a' }, p)) : text;
  return h(tag, { class: cls, style: `--len:${[...text].length}` }, content);
}

export function renderStimulus(task, el) {
  el.replaceChildren(wordEl('div', 'flash-text flash-word school', task.answer, task.stimulus.parts, task.colors));
}

export function renderChoices(task, el, onPick) {
  const buttons = renderChoiceButtons(el, task.choices, (v) => wordEl('span', 'word school', v, task.parts[v], task.colors), onPick);
  el.firstElementChild.classList.add('words');
  return buttons;
}

export function speakPrompt(task) {
  return task.kind === 'syllable' ? 'Welche Silbe war das?' : 'Welches Wort war das?';
}

export function speakSolution(task, settings) {
  const t = task.answer;
  const lines = [`Das war ${t}.`, `Es war ${t}.`, `Richtig ist ${t}.`];
  const parts = task.stimulus.parts;
  if (settings.speech !== 'lots' || parts.length < 2) return lines;
  return lines.map((l) => `${parts.join(' – ')}. ${l}`);
}
