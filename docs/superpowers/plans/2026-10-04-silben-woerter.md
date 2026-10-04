# Silben & Wörter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New flash exercise "Silben & Wörter": syllables and short words built only from known letters, answered from 4 written choices, with colored syllables and custom words in the parent area.

**Architecture:** Pure logic in `js/exercises/words.js` (word list, syllabification, custom-word validation, pool building) and `js/exercises/syllables.js` (exercise contract: stages, task + distractors, render, speech). Registered in `js/exercises/index.js`; `session.js`, `adaptive.js` and `ui/round.js` stay untouched. Settings live in `settings.syllables` and are sanitized in `js/profiles.js`.

**Tech Stack:** Plain ES modules, no build; `node --test` unit tests; Playwright e2e; `npm run precache` for the service worker.

**Spec:** `docs/superpowers/specs/2026-10-04-silben-woerter-design.md`

## Global Constraints

- UI texts German, code/commits English, branch `main`; commit as the repo-local git user (noreply address is already configured).
- Logic modules have no DOM access; only `js/storage.js` touches localStorage; user text never via innerHTML (use `h()` from `js/ui/dom.js`).
- Test hooks via `data-testid`.
- After any change to `index.html`, `manifest.webmanifest`, `js/`, `css/`, `assets/`: run `npm run precache` before committing (a unit test checks it).
- Correct capitalization always: words exactly as stored, syllables first letter upper, rest lower (`Ma`, `Ella`, never `ELLA`/`ella`).
- Custom words: only letters from `LETTERS` (any case) plus `|`; 2–12 letters; max 50; case-insensitive duplicates rejected.
- Exercise id `syllables`, title `Silben & Wörter`, after `letters` in `EXERCISE_ORDER`; defaults `exercises.syllables: true`, `syllables: { colors: true, custom: [] }`.
- Version 1.2.0.

## Review Focus

1. Very few known letters (e.g. only `A`, `M`) – exercise must be hidden (pool < 4) and `createTask` must never loop forever or return fewer than 4 distinct choices when available. → test in Task 3 (`A,M,O` over 300 seeds; `A,M` unavailable).
2. `ß` and umlauts – `'ß'.toUpperCase()` is `'SS'`; casing helpers must keep `ß` a single character and words like `Mö|we` must be playable with `Ö` known. → tests in Task 1.
3. Old profiles / imported backups without `settings.syllables` or with garbage in `custom` – must load with defaults, invalid entries dropped. → tests in Task 2.
4. Changing known letters so that the current level no longer exists – level must be clamped, round must still start. → test in Task 3 (`maxComplexity` shrinks; `createTask` with complexity above available stage still works).
5. Answer buttons must not give away the answer through coloring or casing – all four choices use the same capitalization style and are split by the same rule. → test in Task 3.

---

### Task 1: Word list, syllabification and pool (`words.js`)

**Files:**
- Create: `js/exercises/words.js`
- Test: `tests/unit/words.test.js`

**Interfaces:**
- Consumes: `LETTERS` from `js/exercises/letters.js` (array of 30 upper-case keys incl. `Ä Ö Ü ß`).
- Produces:
  - `VOWELS: string[]` (upper-case keys)
  - `MAX_CUSTOM = 50`
  - `letterKey(c: string): string` – upper-case key, `ß` stays `ß`
  - `applyCase(chars: string[], pattern: string[]): string` – char i upper iff `pattern[i]` is upper
  - `syllabify(text: string): string[]`
  - `wordLevel(parts: string[]): 1 | 2`
  - `parseCustomWord(input: string): { text, split } | { error }`
  - `sanitizeCustom(list: unknown): { text, split }[]`
  - `buildPool(settings): { text: string, parts: string[], level: 0|1|2 }[]` – reads `settings.letters.known`, `settings.syllables?.custom`

- [ ] **Step 1: Write the failing tests**

`tests/unit/words.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  letterKey, applyCase, syllabify, wordLevel, parseCustomWord, sanitizeCustom, buildPool, WORDS, MAX_CUSTOM,
} from '../../js/exercises/words.js';
import { LETTERS } from '../../js/exercises/letters.js';

const S = (known, custom = []) => ({ letters: { known }, syllables: { colors: true, custom } });

test('letterKey keeps ß and upper-cases everything else', () => {
  assert.equal(letterKey('ß'), 'ß');
  assert.equal(letterKey('ö'), 'Ö');
  assert.equal(letterKey('m'), 'M');
});

test('applyCase copies the casing pattern position by position', () => {
  assert.equal(applyCase(['E', 'L', 'A'], [...'Lea']), 'Ela');
  assert.equal(applyCase(['ß', 'A'], [...'Ma']), 'ßa');
  assert.equal(applyCase(['m', 'o'], [...'Om']), 'Mo');
});

test('syllabify follows the simple German rules', () => {
  const cases = {
    Oma: ['O', 'ma'], Ella: ['El', 'la'], Lea: ['Le', 'a'], Mai: ['Mai'], Banane: ['Ba', 'na', 'ne'],
    Tasche: ['Ta', 'sche'], Emil: ['E', 'mil'], Zucker: ['Zu', 'cker'], Lampe: ['Lam', 'pe'], Auto: ['Au', 'to'],
    Ma: ['Ma'], Om: ['Om'], Mm: ['Mm'], Möwe: ['Mö', 'we'],
  };
  for (const [w, parts] of Object.entries(cases)) assert.deepEqual(syllabify(w), parts, w);
});

test('wordLevel: two open syllables are level 1, everything else level 2', () => {
  assert.equal(wordLevel(['Ma', 'ma']), 1);
  assert.equal(wordLevel(['Le', 'a']), 1);
  assert.equal(wordLevel(['El', 'la']), 2);
  assert.equal(wordLevel(['Ba', 'na', 'ne']), 2);
  assert.equal(wordLevel(['Ben']), 2);
});

test('built-in list: valid letters, capitalized, split joins to the word', () => {
  assert.ok(WORDS.length >= 80 && WORDS.length <= 120, `got ${WORDS.length}`);
  for (const w of WORDS) {
    const text = w.replaceAll('|', '');
    assert.ok([...text].every((c) => LETTERS.includes(letterKey(c))), w);
    assert.equal(text[0], text[0].toUpperCase(), w);
    assert.equal(text.slice(1), text.slice(1).toLowerCase(), w);
  }
  assert.equal(new Set(WORDS.map((w) => w.replaceAll('|', '').toLowerCase())).size, WORDS.length);
});

test('parseCustomWord accepts letters and |, splits automatically otherwise', () => {
  assert.deepEqual(parseCustomWord(' El|la '), { text: 'Ella', split: 'El|la' });
  assert.deepEqual(parseCustomWord('Oma'), { text: 'Oma', split: 'O|ma' });
  assert.deepEqual(parseCustomWord('Jörß'), { text: 'Jörß', split: 'Jörß' });
  for (const bad of ['', 'A', 'Max1', 'Ma x', 'Ma||x', '|Max', 'Abcdefghijklm', 'Café']) assert.ok(parseCustomWord(bad).error, bad);
});

test('sanitizeCustom drops invalid, mismatched and duplicate entries and caps the list', () => {
  const list = [
    { text: 'Ella', split: 'El|la' }, { text: 'X1', split: 'X1' }, { text: 'ella', split: 'el|la' },
    'Lea', null, { text: 'Lea', split: 'Lo|a' }, { text: 'Mia' },
  ];
  assert.deepEqual(sanitizeCustom(list), [{ text: 'Ella', split: 'El|la' }, { text: 'Mia', split: 'Mi|a' }]);
  assert.deepEqual(sanitizeCustom('nope'), []);
  const L = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L'];
  const many = Array.from({ length: 60 }, (_, i) => ({ text: `M${L[i % 10].toLowerCase()}${L[Math.floor(i / 10)].toLowerCase()}` }));
  assert.equal(sanitizeCustom(many).length, MAX_CUSTOM);
});

test('pool for A, M, O: generated syllables and matching words only', () => {
  const pool = buildPool(S(['A', 'M', 'O']));
  const texts = pool.map((e) => e.text).sort();
  assert.deepEqual(texts, ['Am', 'Ma', 'Mama', 'Mo', 'Om', 'Oma']);
  assert.deepEqual(pool.find((e) => e.text === 'Oma'), { text: 'Oma', parts: ['O', 'ma'], level: 1 });
  assert.equal(pool.find((e) => e.text === 'Ma').level, 0);
});

test('pool respects umlauts and ignores case when matching known letters', () => {
  const pool = buildPool(S(['M', 'Ö', 'W', 'E']));
  assert.ok(pool.some((e) => e.text === 'Möwe'));
  assert.ok(!pool.some((e) => e.text === 'Oma'));
});

test('custom words join the pool and override the stored split', () => {
  const pool = buildPool(S(['M', 'O', 'A'], [{ text: 'Momo', split: 'Mo|mo' }, { text: 'Oma', split: 'Om|a' }]));
  assert.deepEqual(pool.find((e) => e.text === 'Momo'), { text: 'Momo', parts: ['Mo', 'mo'], level: 1 });
  assert.deepEqual(pool.find((e) => e.text === 'Oma').parts, ['Om', 'a']);
  assert.ok(!buildPool(S(['M', 'O'], [{ text: 'Lola', split: 'Lo|la' }])).some((e) => e.text === 'Lola'));
});

test('no syllables are generated with ß or for unknown vowels', () => {
  const pool = buildPool(S(['ß', 'A', 'S']));
  assert.ok(pool.every((e) => !e.text.includes('ß') || e.level > 0));
  assert.deepEqual(buildPool(S(['M', 'N'])), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/unit/words.test.js`
Expected: FAIL – `Cannot find module .../js/exercises/words.js`

- [ ] **Step 3: Implement `js/exercises/words.js`**

```js
import { LETTERS } from './letters.js';

export const VOWELS = ['A', 'E', 'I', 'O', 'U', 'Ä', 'Ö', 'Ü'];
export const MAX_CUSTOM = 50;
const VOWEL_UNITS = ['ei', 'ai', 'au', 'eu', 'äu', 'ie'];
const CONSONANT_UNITS = ['sch', 'ch', 'ck', 'qu'];
// consonants that make readable consonant+vowel / vowel+consonant syllables
const CV_CONSONANTS = ['B', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W', 'Z'];
const VC_CONSONANTS = ['F', 'L', 'M', 'N', 'R', 'S', 'T'];

// built-in list: nouns and names in correct spelling, syllables split with |
export const WORDS = [
  'Ma|ma', 'Pa|pa', 'O|ma', 'O|pa', 'Tan|te', 'On|kel',
  'El|la', 'Le|a', 'Mi|a', 'O|le', 'E|mil', 'Ni|na', 'An|na', 'Ot|to', 'Li|na', 'Lo|la', 'Ti|na', 'Ti|mo',
  'Le|o', 'Ma|ra', 'Ja|na', 'Lu|ka', 'To|ni', 'Ben', 'Tom', 'Max', 'Paul', 'Lu|na', 'Mo|na', 'Li|sa', 'E|va',
  'A|mi|ra', 'Ma|ri|e', 'Sa|ra', 'Ma|ja', 'Ja|kob', 'Nils', 'Fi|ne', 'Li|a', 'No|ah', 'I|da', 'Han|na',
  'La|ma', 'Ha|se', 'E|sel', 'I|gel', 'Ka|mel', 'Wal', 'Hund', 'Kuh', 'Maus', 'Ka|ter', 'Ra|be', 'Mö|we',
  'Bär', 'Rob|be', 'Af|fe', 'En|te', 'Lö|we', 'Kat|ze', 'Ti|ger', 'Pu|ma', 'Pferd', 'Huhn', 'Fisch',
  'Ze|bra', 'Ko|a|la',
  'Ba|na|ne', 'To|ma|te', 'Me|lo|ne', 'Ro|si|ne', 'Li|mo', 'Ei', 'Eis', 'Su|pe', 'Kä|se', 'Nu|del', 'Mus',
  'Brot', 'Ku|chen', 'Piz|za', 'Ap|fel', 'Ho|nig', 'Saft', 'Milch', 'Tee',
  'So|fa', 'Ho|se', 'Ro|se', 'Na|se', 'Do|se', 'Va|se', 'Au|to', 'Ball', 'Haus', 'Hut', 'Rad', 'Ro|bo|ter',
  'Ra|ke|te', 'Mo|tor', 'Ta|fel', 'Lam|pe', 'Lu|pe', 'Na|del', 'O|fen', 'Müt|ze', 'Ta|sche',
  'Tor', 'Bus', 'Zug', 'Boot', 'Rol|ler', 'Pup|pe', 'Son|ne', 'Mond', 'Stern', 'Tul|pe', 'Ki|no',
  'Pi|rat', 'Mu|sik',
];

export const letterKey = (c) => (c === 'ß' ? 'ß' : c.toUpperCase());
const isUpper = (c) => typeof c === 'string' && c !== 'ß' && c === c.toUpperCase() && c !== c.toLowerCase();
const isVowel = (c) => VOWELS.includes(letterKey(c));

export function applyCase(chars, pattern) {
  return chars.map((c, i) => (isUpper(pattern[i]) ? letterKey(c) : c.toLowerCase())).join('');
}

function units(lower) {
  const out = [];
  let i = 0;
  while (i < lower.length) {
    const rest = lower.slice(i);
    const v = VOWEL_UNITS.find((u) => rest.startsWith(u));
    const c = v ? null : CONSONANT_UNITS.find((u) => rest.startsWith(u));
    const len = (v ?? c ?? rest[0]).length;
    out.push({ start: i, vowel: Boolean(v) || (!c && isVowel(rest[0])) });
    i += len;
  }
  return out;
}

export function syllabify(text) {
  const u = units(text.toLowerCase());
  const vi = u.flatMap((x, i) => (x.vowel ? [i] : []));
  const cuts = [];
  for (let k = 0; k < vi.length - 1; k++) {
    // no consonant between vowels: cut before the 2nd vowel; else before the last consonant
    const at = vi[k + 1] - vi[k] === 1 ? vi[k + 1] : vi[k + 1] - 1;
    cuts.push(u[at].start);
  }
  const bounds = [0, ...cuts, text.length];
  return bounds.slice(0, -1).map((b, i) => text.slice(b, bounds[i + 1]));
}

export function wordLevel(parts) {
  return parts.length === 2 && parts.every((p) => isVowel(p.at(-1))) ? 1 : 2;
}

export function parseCustomWord(input) {
  const raw = String(input ?? '').trim();
  const chars = [...raw.replaceAll('|', '')];
  if (chars.some((c) => !LETTERS.includes(letterKey(c)))) return { error: 'Nur Buchstaben (A–Z, Ä, Ö, Ü, ß) und | sind erlaubt.' };
  if (chars.length < 2 || chars.length > 12) return { error: 'Ein Wort braucht 2 bis 12 Buchstaben.' };
  const pieces = raw.split('|');
  if (pieces.some((p) => p === '')) return { error: 'Vor und nach jedem | muss ein Buchstabe stehen.' };
  const text = pieces.join('');
  const parts = pieces.length > 1 ? pieces : syllabify(text);
  return { text, split: parts.join('|') };
}

export function sanitizeCustom(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const e of list) {
    if (out.length >= MAX_CUSTOM) break;
    if (!e || typeof e !== 'object' || typeof e.text !== 'string') continue;
    const r = parseCustomWord(typeof e.split === 'string' ? e.split : e.text);
    if (r.error || r.text !== e.text) continue;
    const key = r.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function generatedSyllables(known) {
  const vowels = VOWELS.filter((v) => known.includes(v));
  const cv = CV_CONSONANTS.filter((c) => known.includes(c)).flatMap((c) => vowels.map((v) => c + v.toLowerCase()));
  const vc = VC_CONSONANTS.filter((c) => known.includes(c)).flatMap((c) => vowels.map((v) => v + c.toLowerCase()));
  return [...cv, ...vc];
}

export function buildPool(settings) {
  const known = settings.letters.known;
  const playable = (text) => [...text].every((c) => known.includes(letterKey(c)));
  const entries = new Map();
  const add = (text, parts, level) => {
    const key = text.toLowerCase();
    if (!entries.has(key) && playable(text)) entries.set(key, { text, parts, level });
  };
  for (const c of settings.syllables?.custom ?? []) {
    const parts = c.split.split('|');
    add(c.text, parts, wordLevel(parts));
  }
  for (const w of WORDS) {
    const parts = w.split('|');
    add(parts.join(''), parts, wordLevel(parts));
  }
  for (const s of generatedSyllables(known)) add(s, [s], 0);
  return [...entries.values()];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/unit/words.test.js`
Expected: PASS (all tests). If the `WORDS.length` or any word assertion fails, fix the list entry, not the test.

- [ ] **Step 5: Commit**

```bash
git add js/exercises/words.js tests/unit/words.test.js
git commit -m "feat: add word list, syllabification and pool for syllables exercise"
```
(`npm run precache` is run in Task 3, when the module is first loaded by the app; the precache unit test only runs with `npm test`. If `npm test` is run here and the precache test fails, run `npm run precache` and add `sw.js` to this commit.)

---

### Task 2: Settings defaults and sanitizing (`profiles.js`)

**Files:**
- Modify: `js/profiles.js` (imports at top; `DEFAULT_SETTINGS` lines 13–21; `sanitizeSettings` return object ~line 87–110)
- Test: `tests/unit/profiles.test.js` (append)

**Interfaces:**
- Consumes: `sanitizeCustom(list)` from Task 1.
- Produces: `settings.syllables = { colors: boolean, custom: { text, split }[] }`; `settings.exercises.syllables: boolean`. Every loaded/imported profile has them.

- [ ] **Step 1: Write the failing tests** (append to `tests/unit/profiles.test.js`)

```js
test('defaults include the syllables exercise and its settings', () => {
  assert.equal(DEFAULT_SETTINGS.exercises.syllables, true);
  assert.deepEqual(DEFAULT_SETTINGS.syllables, { colors: true, custom: [] });
});

test('old profiles without syllables settings get defaults', () => {
  const old = mk('p1');
  delete old.settings.syllables;
  delete old.settings.exercises.syllables;
  const p = normalizeProfile(old);
  assert.deepEqual(p.settings.syllables, { colors: true, custom: [] });
  assert.equal(p.settings.exercises.syllables, true);
});

test('invalid custom words are dropped when loading or importing', () => {
  const raw = mk('p1');
  raw.settings.syllables = {
    colors: false,
    custom: [{ text: 'Ella', split: 'El|la' }, { text: '<b>', split: '<b>' }, { text: 'ELLA', split: 'EL|LA' }, 42],
  };
  const p = normalizeProfile(raw);
  assert.deepEqual(p.settings.syllables, { colors: false, custom: [{ text: 'Ella', split: 'El|la' }] });
  const data = { schemaVersion: 1, activeProfileId: 'p1', profiles: [raw] };
  assert.deepEqual(parseImport(JSON.stringify(data)).profiles[0].settings.syllables.custom, [{ text: 'Ella', split: 'El|la' }]);
});

test('updateSettings replaces the custom word list', () => {
  const p = updateSettings(mk('p1'), { syllables: { custom: [{ text: 'Mia', split: 'Mi|a' }] } });
  assert.deepEqual(p.settings.syllables.custom, [{ text: 'Mia', split: 'Mi|a' }]);
  const q = updateSettings(p, { syllables: { custom: [] } });
  assert.deepEqual(q.settings.syllables.custom, []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/unit/profiles.test.js`
Expected: FAIL – `DEFAULT_SETTINGS.exercises.syllables` is `undefined`.

- [ ] **Step 3: Implement**

In `js/profiles.js` add the import below the `LETTERS` import:

```js
import { sanitizeCustom } from './exercises/words.js';
```

Replace `DEFAULT_SETTINGS`:

```js
export const DEFAULT_SETTINGS = {
  exercises: { quantity: true, digits: true, letters: true, syllables: true },
  timing: { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: true },
  quantity: { max: 10, layout: 'mixed' },
  digits: { range: 9 },
  letters: { known: ['A', 'M', 'O'], case: 'upper', speak: 'sound' },
  syllables: { colors: true, custom: [] },
  speech: 'little',
  sounds: true,
};
```

In `sanitizeSettings`, insert after the `letters: { ... },` block of the returned object:

```js
    syllables: {
      colors: bool(sub('syllables').colors, d.syllables.colors),
      custom: sanitizeCustom(sub('syllables').custom),
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/unit/profiles.test.js`
Expected: PASS except possibly `every exercise implements the module contract` – it still passes because `syllables` is not registered yet. All new tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/profiles.js tests/unit/profiles.test.js
git commit -m "feat: add syllables settings with sanitized custom words"
```

---

### Task 3: Exercise module, registration, menu tile and styles

**Files:**
- Create: `js/exercises/syllables.js`
- Modify: `js/exercises/index.js`, `js/ui/menu.js` (`TILE_CONTENT`, lines 6–10), `css/app.css` (`:root` tokens line 8; append rules at end)
- Test: `tests/unit/syllables.test.js`, `tests/e2e/round.spec.js` (append)

**Interfaces:**
- Consumes: `buildPool`, `syllabify`, `letterKey`, `applyCase`, `VOWELS` (Task 1); `settings.syllables` (Task 2); `pick`, `shuffle` from `js/rng.js`; `h` from `js/ui/dom.js`; `renderChoiceButtons(el, choices, label, onPick)` from `js/ui/choice-buttons.js`.
- Produces: module contract used by `session.js` / `ui/round.js` / `ui/parents.js`: `id`, `title`, `isAvailable(settings)`, `stages(settings)`, `maxComplexity(settings)`, `startComplexity()`, `describeLevel(c, settings)`, `prepareRound()`, `createTask(level, settings, rng, ctx)`, `renderStimulus(task, el)`, `renderChoices(task, el, onPick)`, `speakPrompt(task)`, `speakSolution(task, settings)`; plus `buildDistractors(answer, pool, knownKeys, rng)` for tests.
- Task shape: `{ exercise: 'syllables', stimulus: { text, parts }, answer, choices: string[4], parts: { [choice]: string[] }, kind: 'syllable'|'word', colors: boolean }`.

- [ ] **Step 1: Write the failing unit tests** – `tests/unit/syllables.test.js`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as syl from '../../js/exercises/syllables.js';
import { letterKey } from '../../js/exercises/words.js';
import { mulberry32 } from '../../js/rng.js';

const S = (known, extra = {}) => ({
  letters: { known }, syllables: { colors: true, custom: [] }, speech: 'little', ...extra,
});
const make = (settings, complexity, seed, ctx = { last: null }) => syl.createTask({ complexity }, settings, mulberry32(seed), ctx);
const capitalized = (t) => t[0] === letterKey(t[0]) && t.slice(1) === t.slice(1).toLowerCase();

test('availability needs at least 4 playable entries', () => {
  assert.equal(syl.isAvailable(S(['A', 'M'])), false);
  assert.equal(syl.isAvailable(S(['M', 'N'])), false);
  assert.equal(syl.isAvailable(S(['A', 'M', 'O'])), true);
});

test('stages grow with the available material', () => {
  assert.equal(syl.maxComplexity(S(['A', 'M', 'O'])), 1);
  assert.equal(syl.maxComplexity(S(['A', 'M', 'O', 'L', 'E'])), 2);
  assert.equal(syl.startComplexity(), 0);
  assert.equal(syl.describeLevel(0, S(['A', 'M', 'O'])), 'Silben');
});

test('tasks with A, M, O: 4 distinct choices from known letters, all capitalized like the answer', () => {
  const known = ['A', 'M', 'O'];
  for (const c of [0, 1]) {
    for (let seed = 0; seed < 300; seed++) {
      const t = make(S(known), c, seed);
      assert.equal(t.choices.length, 4);
      assert.equal(new Set(t.choices).size, 4);
      assert.ok(t.choices.includes(t.answer));
      for (const ch of t.choices) {
        assert.ok([...ch].every((x) => known.includes(letterKey(x))), ch);
        assert.equal(capitalized(ch), capitalized(t.answer), `${ch} vs ${t.answer}`);
        assert.deepEqual(t.parts[ch].join(''), ch);
      }
    }
  }
});

test('level 0 asks for syllables, higher levels mostly for words', () => {
  const s = S(['A', 'M', 'O', 'L', 'E', 'N', 'I']);
  for (let seed = 0; seed < 50; seed++) assert.equal(make(s, 0, seed).kind, 'syllable');
  const words = Array.from({ length: 100 }, (_, seed) => make(s, 2, seed)).filter((t) => t.kind === 'word');
  assert.ok(words.length >= 50);
});

test('thin level mixes in lower entries, complexity beyond the top still works', () => {
  const s = S(['A', 'M', 'O']);
  const kinds = new Set(Array.from({ length: 100 }, (_, seed) => make(s, 1, seed).kind));
  assert.deepEqual([...kinds].sort(), ['syllable', 'word']);
  assert.doesNotThrow(() => make(s, 5, 1));
});

test('the same entry does not come twice in a row when there is a choice', () => {
  const s = S(['A', 'M', 'O', 'L', 'E']);
  const ctx = syl.prepareRound();
  let last = null;
  for (let seed = 0; seed < 100; seed++) {
    const t = make(s, 0, seed, ctx);
    assert.notEqual(t.answer, last);
    last = t.answer;
  }
});

test('custom words are used and keep their split', () => {
  const s = S(['M', 'O', 'A'], { syllables: { colors: false, custom: [{ text: 'Momo', split: 'Mo|mo' }] } });
  const tasks = Array.from({ length: 200 }, (_, seed) => make(s, 1, seed));
  const momo = tasks.find((t) => t.answer === 'Momo');
  assert.ok(momo);
  assert.deepEqual(momo.stimulus.parts, ['Mo', 'mo']);
  assert.equal(momo.colors, false);
});

test('distractors prefer swapped and similar-looking variants', () => {
  const pool = [{ text: 'Lea', parts: ['Le', 'a'], level: 1 }];
  const d = syl.buildDistractors('Lea', pool, ['A', 'E', 'L', 'I'], mulberry32(3));
  assert.equal(d.length, 3);
  assert.ok(d.some((x) => ['Ela', 'Lae'].includes(x)), d.join());
  assert.ok(!d.includes('Lea'));
});

test('speech: prompt by kind, syllable spelling only in mode lots', () => {
  const t = { answer: 'Ella', stimulus: { text: 'Ella', parts: ['El', 'la'] }, kind: 'word' };
  assert.equal(syl.speakPrompt(t), 'Welches Wort war das?');
  assert.equal(syl.speakPrompt({ ...t, kind: 'syllable' }), 'Welche Silbe war das?');
  assert.ok(syl.speakSolution(t, { speech: 'little' }).every((l) => l.includes('Ella') && !l.includes('–')));
  assert.ok(syl.speakSolution(t, { speech: 'lots' }).every((l) => l.startsWith('El – la. ')));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/unit/syllables.test.js`
Expected: FAIL – `Cannot find module .../js/exercises/syllables.js`

- [ ] **Step 3: Implement `js/exercises/syllables.js`**

```js
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
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `node --test tests/unit/syllables.test.js`
Expected: PASS. If `buildDistractors` test fails because the seed picks only replacements, the assertion `d.some(... swap ...)` must still hold – `add(s[0])` always adds the first swap; investigate rather than changing the seed.

- [ ] **Step 5: Register, menu tile, styles**

`js/exercises/index.js`:

```js
import * as quantity from './quantity.js';
import * as digits from './digits.js';
import * as letters from './letters.js';
import * as syllables from './syllables.js';

export const EXERCISES = { quantity, digits, letters, syllables };
export const EXERCISE_ORDER = ['quantity', 'digits', 'letters', 'syllables'];
```

`js/ui/menu.js` – `TILE_CONTENT` gets a fourth entry:

```js
  syllables: () => h('span', { class: 'tile-syl' }, h('span', {}, 'Ma'), h('span', {}, 'ma')),
```

`css/app.css` – extend line 8 of `:root`:

```css
  --tile-quantity: #EA6458; --tile-digits: #348CE5; --tile-letters: #6B42DE; --tile-syllables: #D9711C;
  --syl-a: #2563C9; --syl-b: #C8322B;
```

and append at the end of the file:

```css
/* syllables & words */
.tile-syllables { background: var(--tile-syllables); }
.tile-syl span + span { opacity: .7; }
.flash-word { font-size: min(40cqh, calc(150cqw / (var(--len) + 1))); white-space: nowrap; padding: .05em .3em; }
.syl-a { color: var(--syl-a); }
.syl-b { color: var(--syl-b); }
.choices.words { grid-template-columns: repeat(2, minmax(120px, 260px)); justify-content: center; }
.choice .word { font-size: clamp(1.4rem, 6vw, 2.2rem); line-height: 1.1; white-space: nowrap; }
.choice.right .word span, .choice.wrong .word span { color: inherit; }
```

- [ ] **Step 6: Add the e2e round test** (append to `tests/e2e/round.spec.js`; `fixed` and `waitForChoices` already exist in that file)

```js
test('a syllables round with the default letters runs to the end with colored syllables', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-syllables').click();
  for (let i = 0; i < 10; i++) {
    const { choices, answer } = await waitForChoices(page);
    await expect(choices.locator('button.choice')).toHaveCount(4);
    await expect(choices.locator('.syl-a').first()).toBeVisible();
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
  const p = (await readState(page)).profiles[0];
  expect(p.history.at(-1)).toMatchObject({ exercise: 'syllables', correct: 10, total: 10 });
});
```

- [ ] **Step 7: Precache and run the full suites**

Run: `npm run precache && npm test && npx playwright test tests/e2e/round.spec.js`
Expected: all unit tests PASS (incl. `every exercise implements the module contract` and the precache check); e2e round tests PASS.

- [ ] **Step 8: Commit**

```bash
git add js/exercises/syllables.js js/exercises/index.js js/ui/menu.js css/app.css sw.js tests/unit/syllables.test.js tests/e2e/round.spec.js
git commit -m "feat: add syllables and words flash exercise"
```

---

### Task 4: Parent area section

**Files:**
- Modify: `js/ui/parents.js` (imports lines 1–11; new helper function after `voiceSelect`; insert fieldset after the `Buchstaben` fieldset in `settingsTab`, ~line 137)
- Modify: `css/app.css` (append)
- Test: `tests/e2e/parents.spec.js` (append)

**Interfaces:**
- Consumes: `buildPool`, `parseCustomWord`, `letterKey`, `MAX_CUSTOM` (Task 1); `settings.syllables` (Task 2); local helpers `fieldset`, `check` and `apply` inside `settingsTab`.
- Produces: test ids `syllables-colors`, `syllables-playable`, `syllables-custom-input`, `syllables-custom-add`, `syllables-custom-msg`, `syllables-custom-<i>`, `syllables-custom-<i>-remove`.

- [ ] **Step 1: Write the failing e2e tests** (append to `tests/e2e/parents.spec.js`)

```js
test('custom words can be added, are validated and can be removed', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await expect(page.getByTestId('syllables-playable')).toContainText('4 Silben, 2 Wörter');
  await page.getByTestId('syllables-custom-input').fill('Lo|la');
  await page.getByTestId('syllables-custom-add').click();
  await expect(page.getByTestId('syllables-custom-0')).toContainText('fehlt: L');
  expect((await readState(page)).profiles[0].settings.syllables.custom).toEqual([{ text: 'Lola', split: 'Lo|la' }]);

  await page.getByTestId('syllables-custom-input').fill('Max1');
  await page.getByTestId('syllables-custom-add').click();
  await expect(page.getByTestId('syllables-custom-msg')).toContainText('Nur Buchstaben');
  await page.getByTestId('syllables-custom-input').fill('lola');
  await page.getByTestId('syllables-custom-add').click();
  await expect(page.getByTestId('syllables-custom-msg')).toContainText('schon in der Liste');
  expect((await readState(page)).profiles[0].settings.syllables.custom).toHaveLength(1);

  await page.getByTestId('syllables-custom-0-remove').click();
  await expect(page.getByTestId('syllables-custom-0')).toHaveCount(0);
  expect((await readState(page)).profiles[0].settings.syllables.custom).toEqual([]);
});

test('the syllable color switch is saved and survives a reload', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('syllables-colors').uncheck();
  expect((await readState(page)).profiles[0].settings.syllables.colors).toBe(false);
  await page.reload();
  expect((await readState(page)).profiles[0].settings.syllables.colors).toBe(false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test tests/e2e/parents.spec.js -g "custom words|color switch"`
Expected: FAIL – `getByTestId('syllables-playable')` not found.

- [ ] **Step 3: Implement**

In `js/ui/parents.js` add the import:

```js
import { buildPool, parseCustomWord, letterKey, MAX_CUSTOM } from '../exercises/words.js';
```

Add after `voiceSelect`:

```js
function syllablesFieldset(s, apply) {
  const pool = buildPool(s);
  const nSyl = pool.filter((e) => e.level === 0).length;
  const custom = s.syllables.custom;
  const msg = h('p', { class: 'form-msg', 'data-testid': 'syllables-custom-msg' });
  const input = h('input', { type: 'text', maxlength: '40', placeholder: 'z. B. El|la', 'aria-label': 'Eigenes Wort', 'data-testid': 'syllables-custom-input' });
  const fail = (text) => { msg.textContent = text; msg.classList.add('error'); };
  const add = () => {
    const r = parseCustomWord(input.value);
    if (r.error) return fail(r.error);
    if (custom.some((c) => c.text.toLowerCase() === r.text.toLowerCase())) return fail('Dieses Wort ist schon in der Liste.');
    if (custom.length >= MAX_CUSTOM) return fail(`Höchstens ${MAX_CUSTOM} eigene Wörter.`);
    return apply({ syllables: { custom: [...custom, r] } });
  };
  const missing = (text) => [...new Set([...text].map(letterKey))].filter((k) => !s.letters.known.includes(k));
  return fieldset('Silben & Wörter', [
    check('Silben farbig zeigen (blau/rot)', s.syllables.colors, (v) => apply({ syllables: { colors: v } }), 'syllables-colors'),
    h('p', { class: 'hint', 'data-testid': 'syllables-playable' },
      `Spielbar gerade: ${nSyl} Silben, ${pool.length - nSyl} Wörter – nur aus bekannten Buchstaben.`),
    h('p', { class: 'hint' }, 'Eigene Wörter, z. B. Namen aus der Familie. Silben mit | trennen (El|la) – ohne | trennt die App selbst.'),
    h('form', { class: 'add-row', onSubmit: (e) => { e.preventDefault(); add(); } },
      input,
      h('button', { type: 'submit', class: 'secondary-btn', 'data-testid': 'syllables-custom-add' }, 'Hinzufügen')),
    msg,
    h('div', { class: 'chip-list' }, custom.map((c, i) => {
      const m = missing(c.text);
      return h('span', { class: 'chip', 'data-testid': `syllables-custom-${i}` },
        c.split.replaceAll('|', '·'),
        m.length ? h('span', { class: 'missing' }, `noch nicht spielbar – fehlt: ${m.join(', ')}`) : null,
        h('button', {
          type: 'button', 'aria-label': `${c.text} löschen`, 'data-testid': `syllables-custom-${i}-remove`,
          onClick: () => apply({ syllables: { custom: custom.filter((_, j) => j !== i) } }),
        }, '×'));
    })),
  ]);
}
```

In `settingsTab`, insert directly after the closing `]),` of `fieldset('Buchstaben', [ ... ])`:

```js
    syllablesFieldset(s, apply),
```

Append to `css/app.css`:

```css
.add-row { display: flex; gap: 8px; align-items: center; }
.add-row input { flex: 1; min-width: 0; }
.chip-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.chip { display: inline-flex; align-items: center; gap: 8px; padding: 4px 4px 4px 12px; border-radius: 999px; background: var(--bg); font-weight: 700; }
.chip .missing { font-weight: 400; font-size: .9rem; color: var(--muted); }
.chip button { width: 40px; height: 40px; border-radius: 50%; background: var(--surface); font-size: 1.3rem; }
```

- [ ] **Step 4: Run e2e tests to verify they pass**

Run: `npm run precache && npx playwright test tests/e2e/parents.spec.js`
Expected: PASS (new and existing parent tests).

- [ ] **Step 5: Commit**

```bash
git add js/ui/parents.js css/app.css sw.js tests/e2e/parents.spec.js
git commit -m "feat: add syllables section with custom words to the parent area"
```

---

### Task 5: Release 1.2.0

**Files:**
- Modify: `package.json`, `package-lock.json` (version), `CHANGELOG.md` (top), `README.md` (exercise list, if it lists exercises)

- [ ] **Step 1: Bump version**

Run: `npm version 1.2.0 --no-git-tag-version`
Expected: `v1.2.0`

- [ ] **Step 2: Changelog** – insert above `## [1.1.0]`:

```markdown
## [1.2.0] – 2026-10-04

- Neue Übung „Silben & Wörter“: Silben und kurze Wörter nur aus bekannten Buchstaben, immer korrekt groß/klein geschrieben
- Drei Stufen: Silben → Wörter aus zwei offenen Silben → alle Wörter; knifflige Ablenker (vertauschte oder ähnlich aussehende Buchstaben)
- Silben farbig (blau/rot) zur Lesehilfe, im Elternbereich abschaltbar
- Eigene Wörter (z. B. Familiennamen) im Elternbereich, mit optionaler Silbentrennung per |
- Im Modus „Viel“ spricht die Lösung zuerst in Silben („El – la. Ella.“)
```

- [ ] **Step 3: README** – run `grep -n "Buchstaben" README.md`; where exercises are listed, add „Silben & Wörter“ next to Mengen, Zahlen, Buchstaben. Skip if no such list.

- [ ] **Step 4: Full verification**

Run: `npm run precache && npm test && npm run e2e`
Expected: all unit and e2e tests PASS. Then `npm run serve` and check manually on a narrow window (≈ 375 px): flash word fits on one line, 2×2 answer grid, colors readable, colored text turns white on the green/red feedback buttons.

- [ ] **Step 5: Commit and tag**

```bash
git add package.json package-lock.json CHANGELOG.md README.md sw.js
git commit -m "chore: release 1.2.0"
git tag v1.2.0
```
Push (`git push && git push --tags`) only after the user confirms. Afterwards update the external `C:\Users\matth\.github_repo\UEBERSICHT.md` (outside this repo) with version 1.2.0.
