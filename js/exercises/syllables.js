import { pick, shuffle } from '../rng.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';
import { LETTERS } from './letters.js';
import { buildPool, syllabify, letterKey, applyCase, VOWELS } from './words.js';

export const id = 'syllables';
export const title = 'Silben & Wörter';
const LEVEL_LABELS = ['Silben', 'Wörter aus zwei offenen Silben', 'alle Wörter'];
const SIMILAR = [['M', 'N', 'W'], ['E', 'F'], ['O', 'Q', 'C', 'G'], ['P', 'R', 'B'], ['I', 'L', 'T'], ['U', 'V'],
  ['B', 'D', 'P', 'Q'], ['N', 'U', 'H', 'M'], ['I', 'L', 'J'], ['A', 'O', 'E'], ['A', 'Ä'], ['O', 'Ö'], ['U', 'Ü'], ['S', 'ß']];

const knownKeys = (settings) => LETTERS.filter((l) => settings.letters.known.includes(l));

export function isAvailable(settings) { return buildPool(settings).length >= 4; }
export function stages(settings) {
  const top = Math.max(0, ...buildPool(settings).map((e) => e.level));
  return LEVEL_LABELS.slice(0, top + 1);
}
export function maxComplexity(settings) { return stages(settings).length - 1; }
export function startComplexity() { return 0; }
export function describeLevel(complexity, settings) {
  const s = stages(settings);
  return s[Math.min(complexity, s.length - 1)];
}
export function prepareRound() { return { last: null }; }

function candidates(pool, complexity, rng) {
  const exact = pool.filter((e) => e.level === complexity);
  const lower = pool.filter((e) => e.level < complexity);
  if (exact.length === 0) return lower.length ? lower : pool;
  if (exact.length < 3 && lower.length && rng() < 0.5) return lower;
  return exact;
}

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

export function buildDistractors(answer, pool, keys, rng) {
  const len = [...answer].length;
  const out = [];
  const add = (t) => {
    if (out.length < 3 && t && t !== answer && !out.includes(t) && [...t].every((c) => keys.includes(letterKey(c)))) out.push(t);
  };
  const { swaps, replacements } = variants(answer, keys);
  const s = shuffle(rng, swaps);
  const r = shuffle(rng, replacements);
  const near = shuffle(rng, pool.map((e) => e.text).filter((t) => Math.abs([...t].length - len) <= 1));
  add(s[0]);
  add(r[0]);
  [...r.slice(1), ...s.slice(1), ...near].forEach(add);
  // last resort for tiny alphabets: random strings of known letters with the answer's casing
  for (let i = 0; out.length < 3 && i < 500; i++) add(applyCase(Array.from({ length: len }, () => pick(rng, keys)), [...answer]));
  return out;
}

const partsFor = (text, pool) => pool.find((e) => e.text === text)?.parts ?? syllabify(text);

export function createTask(level, settings, rng, ctx = { last: null }) {
  const pool = buildPool(settings);
  if (pool.length === 0) throw new Error('no playable syllables or words');
  const cands = candidates(pool, level.complexity, rng);
  let entry = pick(rng, cands);
  if (entry.text === ctx.last && cands.length > 1) entry = pick(rng, cands.filter((e) => e.text !== ctx.last));
  ctx.last = entry.text;
  const choices = shuffle(rng, [entry.text, ...buildDistractors(entry.text, pool, knownKeys(settings), rng)]);
  return {
    exercise: id,
    stimulus: { text: entry.text, parts: entry.parts },
    answer: entry.text,
    choices,
    parts: Object.fromEntries(choices.map((c) => [c, partsFor(c, pool)])),
    kind: entry.level === 0 ? 'syllable' : 'word',
    colors: settings.syllables?.colors !== false,
  };
}

function wordEl(tag, cls, text, parts, colors) {
  const content = colors ? parts.map((p, i) => h('span', { class: i % 2 ? 'syl-b' : 'syl-a' }, p)) : text;
  return h(tag, { class: cls, style: `--len:${[...text].length}` }, content);
}

export function renderStimulus(task, el) {
  el.replaceChildren(wordEl('div', 'flash-text flash-word', task.answer, task.stimulus.parts, task.colors));
}

export function renderChoices(task, el, onPick) {
  const buttons = renderChoiceButtons(el, task.choices, (v) => wordEl('span', 'word', v, task.parts[v], task.colors), onPick);
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
