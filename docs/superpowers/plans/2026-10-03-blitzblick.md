# Blitzblick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installable offline PWA for first graders that flashes quantities, digits or letters briefly and lets the child pick what they saw, with adaptive difficulty, parent area, profiles and a sticker album.

**Architecture:** Plain ES modules without a build step. Pure logic modules (`adaptive`, `session`, `rewards`, `stats`, `storage`, `profiles`, `exercises/*.createTask`) have no DOM access and are unit-tested with `node:test`. UI screens in `js/ui/` render with a tiny `h()` helper; `js/app.js` switches screens. A service worker precaches everything for offline use; GitHub Pages serves the repo root.

**Tech Stack:** HTML/CSS/JavaScript (ES2022 modules), Web Speech API, Web Audio API, Service Worker, Node 24 (`node --test`), Playwright (Chromium), http-server (dev only), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-03-blitzblick-design.md`

## Global Constraints

- No build step, no runtime dependencies; dev dependencies only `@playwright/test` and `http-server`.
- Only `js/storage.js` touches `localStorage`. Logic modules never touch the DOM at import time or in logic functions.
- All child-facing screens: no text except learning content (digits/letters) and numbers; instructions via speech. Parent area and first-run form may use German text.
- UI strings German; code, identifiers, commits English. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Buttons for the child ≥ 64 × 64 px; touch and mouse handled identically via `click`.
- Defaults: `startMs` 1500, `minMs` 300, `maxMs` 3000, round length 10, harder after 3 correct in a row, easier after 2 errors in the last 3, factors 0.85 / 1.2 on a 50 ms grid, 50 stars per album page, 3 bonus stars, history kept 90 days.
- localStorage key `blitzblick.v1`, `schemaVersion` 1; backup keys `blitzblick.corrupt-<ms>` and `blitzblick.pre-import`.
- Export filename `blitzblick-backup-YYYY-MM-DD.json` (local date).
- Test hooks are `data-testid` attributes; never test against German copy except where stated.
- Branch `main`; repo will be **public** (GitHub Pages free plan) – never commit personal data.
- After any change under `index.html`, `manifest.webmanifest`, `js/`, `css/`, `assets/` (from Task 17 on): run `npm run precache` – a unit test enforces it.

## Review Focus

1. **Double tap / fast repeated taps on an answer** → only the first tap counts (Task 9 unit test `double tap`, Task 14 e2e `dblclick`).
2. **Parent lowers limits while the child's level is above them** (e.g. Mengen max 10 → 5, minMs raised) → level is clamped, next task respects new limits (Task 2 `clampLevel`, Task 6 `updateSettings clamps levels`).
3. **Deleting the active or the last profile** → another profile becomes active, or the app shows the create screen; no crash (Task 6 `removeProfile`, Task 16 e2e `delete last profile`).
4. **Phone portrait 360 × 640 with 10 answer buttons** → everything fits without page scroll, each button ≥ 64 px wide (Task 14 e2e `small viewport`).
5. **Round finished just before midnight / timezone** → history uses the local calendar date, not UTC (Task 1 `localDate`, Task 9 `finishRound` date).

---

## File Map

```
index.html, manifest.webmanifest, sw.js
css/app.css
js/app.js                 screen switching, ctx object
js/rng.js                 seeded RNG helpers
js/util.js                localDate
js/adaptive.js            difficulty state machine
js/profiles.js            defaults, profile CRUD, settings merge/normalize
js/storage.js             localStorage, migration, import/export parsing
js/rewards.js             album pages, sticker/star logic
js/session.js             round state machine
js/stats.js               progress summaries for parents
js/speech.js, js/sounds.js
js/exercises/index.js     registry
js/exercises/choices.js   distractor builder
js/exercises/digits.js, letters.js, quantity.js, quantity-layout.js
js/ui/dom.js              h(), wait()
js/ui/widgets.js          iconBtn, starBadge, avatarImg, uiIcon
js/ui/choice-buttons.js   answer buttons with single-fire guard
js/ui/gate.js             long press + parent challenge
js/ui/profiles.js, menu.js, round.js, round-end.js, album.js, parents.js
assets/fonts, objects, avatars, ui, icons, stickers/<page>/<name>.svg
tools/update-precache.mjs, tools/render-icons.mjs, tools/asset-sheet.html
tests/unit/*.test.js, tests/e2e/*.spec.js, tests/e2e/helpers.js
```

### Exercise module contract (all three modules export exactly these)

```js
export const id;                                  // 'quantity' | 'digits' | 'letters'
export const title;                               // German, parent area only
export function isAvailable(settings)             // boolean
export function stages(settings)                  // array of stage descriptors
export function maxComplexity(settings)           // stages(settings).length - 1
export function startComplexity(settings)         // integer
export function describeLevel(complexity, settings) // German string for parents
export function createTask(level, settings, rng, roundCtx) // → { exercise, stimulus, answer, choices }
export function renderStimulus(task, el)
export function renderChoices(task, el, onPick)   // onPick(value, button)
export function speakPrompt(task, settings)       // string
export function speakSolution(task, settings)     // string
// quantity only: export function prepareRound(rng) → { object }
```

---

### Task 1: Repository scaffold, RNG and date helpers

**Files:**
- Create: `package.json`, `.gitignore`, `.gitattributes`, `playwright.config.js`, `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `_lokal/README.md`, `js/rng.js`, `js/util.js`
- Test: `tests/unit/rng.test.js`, `tests/unit/util.test.js`

**Interfaces:**
- Produces: `mulberry32(seed) → () => number`, `randInt(rng, min, max)` (inclusive), `pick(rng, arr)`, `shuffle(rng, arr)` (new array); `localDate(date = new Date()) → 'YYYY-MM-DD'` (local calendar).

- [ ] **Step 1: Create tooling files**

`package.json`:
```json
{
  "name": "blitzblick",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/unit/*.test.js",
    "e2e": "playwright test",
    "serve": "http-server -p 4173 -c-1 .",
    "precache": "node tools/update-precache.mjs",
    "icons": "node tools/render-icons.mjs"
  },
  "devDependencies": {
    "@playwright/test": "^1.60.0",
    "http-server": "^14.1.1"
  }
}
```

`.gitignore`:
```
node_modules/
test-results/
playwright-report/
_lokal/*
!_lokal/README.md
```

`.gitattributes`:
```
* text=auto eol=lf
*.woff2 binary
*.png binary
```

`playwright.config.js`:
```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'allow' },
  webServer: {
    command: 'npx http-server -p 4173 -c-1 -s .',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
  ],
});
```

`_lokal/README.md`:
```markdown
Lokale Notizen und Testdaten. Inhalt außer dieser Datei wird nicht committet.
```

`CHANGELOG.md`:
```markdown
# Changelog

## [Unreleased]
- Projektgerüst
```

`README.md`:
```markdown
# Blitzblick

Web-App für Erstklässler: Mengen, Zahlen oder Buchstaben blitzen kurz auf, danach wählt das Kind, was es gesehen hat. Trainiert das schnelle Erfassen auf einen Blick.

- Läuft im Browser auf Tablet und PC, installierbar als App, offline nutzbar.
- Schwierigkeit passt sich automatisch an; Elternbereich (Zahnrad 3 s halten) für Grenzen, bekannte Buchstaben, Profile und Datensicherung.
- Alle Daten bleiben auf dem Gerät (localStorage).

## Entwicklung

    npm install
    npx playwright install chromium
    npm run serve      # http://localhost:4173
    npm test           # Unit-Tests
    npm run e2e        # Playwright

Design: `docs/superpowers/specs/2026-10-03-blitzblick-design.md`
```

`CLAUDE.md`:
```markdown
# Blitzblick – Hinweise für Claude

## Struktur
- `js/` reine ES-Module, kein Build. Logikmodule (`adaptive`, `session`, `rewards`, `stats`, `storage`, `profiles`, `exercises/*` außer render-Funktionen) ohne DOM-Zugriff → `tests/unit/`.
- `js/ui/` Bildschirme, gerendert mit `h()` aus `js/ui/dom.js`. Nutzernamen nie per innerHTML.
- Nur `js/storage.js` greift auf localStorage zu.
- Neue Übungsart: Datei in `js/exercises/` mit dem Vertrag aus dem Plan, in `js/exercises/index.js` registrieren.

## Start/Test
- `npm run serve`, `npm test`, `npm run e2e`.
- Nach jeder Änderung an `index.html`, `manifest.webmanifest`, `js/`, `css/`, `assets/`: `npm run precache` (Unit-Test prüft das).

## Konventionen
- UI-Texte Deutsch, Code/Commits Englisch, Branch `main`.
- Test-Hooks über `data-testid`.
- Repo ist öffentlich: keine persönlichen Daten committen.
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install; npx playwright install chromium`
Expected: `node_modules/` created, Chromium downloaded.

- [ ] **Step 3: Write failing tests**

`tests/unit/rng.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randInt, pick, shuffle } from '../../js/rng.js';

test('mulberry32 is deterministic per seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('mulberry32 returns values in [0, 1)', () => {
  const r = mulberry32(1);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test('randInt stays within inclusive bounds and reaches both ends', () => {
  const r = mulberry32(1);
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const v = randInt(r, 2, 5);
    assert.ok(v >= 2 && v <= 5);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
});

test('shuffle returns a permutation and does not mutate the input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(mulberry32(3), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
});

test('pick returns an element of the array', () => {
  const r = mulberry32(9);
  for (let i = 0; i < 50; i++) assert.ok(['a', 'b', 'c'].includes(pick(r, ['a', 'b', 'c'])));
});
```

`tests/unit/util.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate } from '../../js/util.js';

test('localDate formats the local calendar date', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 12, 0)), '2026-01-05');
});

test('localDate uses the local date late in the evening (not UTC)', () => {
  assert.equal(localDate(new Date(2026, 9, 3, 23, 59)), '2026-10-03');
  assert.equal(localDate(new Date(2026, 9, 4, 0, 1)), '2026-10-04');
});
```

- [ ] **Step 4: Run tests – expect failure**

Run: `npm test`
Expected: FAIL, `Cannot find module .../js/rng.js`.

- [ ] **Step 5: Implement**

`js/rng.js`:
```js
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

`js/util.js`:
```js
export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
```

- [ ] **Step 6: Run tests – expect pass**

Run: `npm test`
Expected: all 7 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add --renormalize .
git add -A
git commit -m "chore: scaffold project with rng and date helpers"
```

---

### Task 2: Adaptive difficulty

**Files:**
- Create: `js/adaptive.js`
- Test: `tests/unit/adaptive.test.js`

**Interfaces:**
- Consumes: `mulberry32` (tests only).
- Produces:
  - `initialLevel(timing, complexity) → { durationMs, complexity, streak: 0, recent: [] }`
  - `clampLevel(level, timing, maxComplexity) → level`
  - `effectiveLevel(level, timing, maxComplexity) → { durationMs, complexity }`
  - `recordResult(level, correct, timing, maxComplexity) → level`
  - `timing` shape: `{ startMs, minMs, maxMs, adaptive }`.

- [ ] **Step 1: Write failing tests**

`tests/unit/adaptive.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLevel, clampLevel, effectiveLevel, recordResult } from '../../js/adaptive.js';
import { mulberry32 } from '../../js/rng.js';

const T = { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: true };
const lvl = (o = {}) => ({ durationMs: 1500, complexity: 2, streak: 0, recent: [], ...o });
const run = (level, results, maxC = 5, t = T) => results.reduce((l, r) => recordResult(l, r, t, maxC), level);

test('initialLevel uses startMs and the given complexity', () => {
  assert.deepEqual(initialLevel(T, 4), { durationMs: 1500, complexity: 4, streak: 0, recent: [] });
});

test('two correct answers only raise the streak', () => {
  const l = run(lvl(), [true, true]);
  assert.equal(l.durationMs, 1500);
  assert.equal(l.streak, 2);
});

test('three correct in a row shorten duration by 15 % floored to 50 ms and reset counters', () => {
  const l = run(lvl(), [true, true, true]);
  assert.equal(l.durationMs, 1250);
  assert.equal(l.complexity, 2);
  assert.equal(l.streak, 0);
  assert.deepEqual(l.recent, []);
});

test('duration never drops below minMs', () => {
  assert.equal(run(lvl({ durationMs: 320 }), [true, true, true]).durationMs, 300);
});

test('at minMs, harder raises complexity and sets duration to 2 × minMs', () => {
  const l = run(lvl({ durationMs: 300 }), [true, true, true]);
  assert.equal(l.complexity, 3);
  assert.equal(l.durationMs, 600);
});

test('at minMs and max complexity nothing gets harder', () => {
  const l = run(lvl({ durationMs: 300, complexity: 5 }), [true, true, true]);
  assert.equal(l.complexity, 5);
  assert.equal(l.durationMs, 300);
});

test('two errors in the last three lengthen duration by 20 % ceiled to 50 ms', () => {
  const l = run(lvl(), [false, true, false]);
  assert.equal(l.durationMs, 1800);
  assert.equal(l.complexity, 2);
});

test('duration never exceeds maxMs', () => {
  assert.equal(run(lvl({ durationMs: 2900 }), [false, false]).durationMs, 3000);
});

test('at maxMs, easier lowers complexity and sets duration to maxMs / 2', () => {
  const l = run(lvl({ durationMs: 3000 }), [false, false]);
  assert.equal(l.complexity, 1);
  assert.equal(l.durationMs, 1500);
});

test('at maxMs and complexity 0 nothing gets easier', () => {
  const l = run(lvl({ durationMs: 3000, complexity: 0 }), [false, false]);
  assert.equal(l.complexity, 0);
  assert.equal(l.durationMs, 3000);
});

test('a single error resets the streak without adjusting', () => {
  const l = run(lvl(), [true, true, false]);
  assert.equal(l.streak, 0);
  assert.equal(l.durationMs, 1500);
});

test('duration and complexity never move in the same direction in one step', () => {
  const rng = mulberry32(7);
  let l = lvl();
  for (let i = 0; i < 2000; i++) {
    const next = recordResult(l, rng() < 0.7, T, 5);
    assert.ok(!(next.durationMs < l.durationMs && next.complexity > l.complexity), 'both harder');
    assert.ok(!(next.durationMs > l.durationMs && next.complexity < l.complexity), 'both easier');
    l = next;
  }
});

test('with adaptive off, results never change duration or complexity', () => {
  const t = { ...T, adaptive: false };
  const l = run(lvl(), [true, true, true, false, false, false], 5, t);
  assert.equal(l.durationMs, 1500);
  assert.equal(l.complexity, 2);
});

test('effectiveLevel with adaptive off uses startMs and max complexity', () => {
  assert.deepEqual(effectiveLevel(lvl({ durationMs: 400 }), { ...T, startMs: 900, adaptive: false }, 4), { durationMs: 900, complexity: 4 });
});

test('effectiveLevel with adaptive on returns the clamped level', () => {
  assert.deepEqual(effectiveLevel(lvl({ durationMs: 100, complexity: 9 }), T, 4), { durationMs: 300, complexity: 4 });
});

test('clampLevel pulls a level into lowered parent limits', () => {
  const l = clampLevel(lvl({ durationMs: 200, complexity: 9 }), T, 3);
  assert.equal(l.durationMs, 300);
  assert.equal(l.complexity, 3);
});

test('recordResult clamps an out-of-range level first', () => {
  assert.equal(recordResult(lvl({ complexity: 9 }), true, T, 3).complexity, 3);
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, module `js/adaptive.js` not found.

- [ ] **Step 3: Implement**

`js/adaptive.js`:
```js
const HARDER = 0.85;
const EASIER = 1.2;
const STEP = 50;
const floorStep = (ms) => Math.floor(ms / STEP) * STEP;
const ceilStep = (ms) => Math.ceil(ms / STEP) * STEP;
const roundStep = (ms) => Math.round(ms / STEP) * STEP;

export function initialLevel(timing, complexity) {
  return { durationMs: timing.startMs, complexity, streak: 0, recent: [] };
}

export function clampLevel(level, timing, maxComplexity) {
  return {
    ...level,
    durationMs: Math.min(timing.maxMs, Math.max(timing.minMs, level.durationMs)),
    complexity: Math.min(maxComplexity, Math.max(0, level.complexity)),
  };
}

export function effectiveLevel(level, timing, maxComplexity) {
  if (!timing.adaptive) return { durationMs: timing.startMs, complexity: maxComplexity };
  const c = clampLevel(level, timing, maxComplexity);
  return { durationMs: c.durationMs, complexity: c.complexity };
}

function harder(l, t, maxC) {
  if (l.durationMs > t.minMs) return { ...l, durationMs: Math.max(t.minMs, floorStep(l.durationMs * HARDER)) };
  if (l.complexity < maxC) return { ...l, complexity: l.complexity + 1, durationMs: Math.min(t.maxMs, t.minMs * 2) };
  return l;
}

function easier(l, t) {
  if (l.durationMs < t.maxMs) return { ...l, durationMs: Math.min(t.maxMs, ceilStep(l.durationMs * EASIER)) };
  if (l.complexity > 0) return { ...l, complexity: l.complexity - 1, durationMs: Math.max(t.minMs, roundStep(t.maxMs / 2)) };
  return l;
}

export function recordResult(level, correct, timing, maxComplexity) {
  const recent = [...level.recent, correct].slice(-3);
  const streak = correct ? level.streak + 1 : 0;
  const base = { ...clampLevel(level, timing, maxComplexity), recent, streak };
  if (!timing.adaptive) return base;
  if (streak >= 3) return { ...harder(base, timing, maxComplexity), streak: 0, recent: [] };
  if (recent.filter((r) => !r).length >= 2) return { ...easier(base, timing), streak: 0, recent: [] };
  return base;
}
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: all adaptive tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/adaptive.js tests/unit/adaptive.test.js
git commit -m "feat: add adaptive difficulty state machine"
```

---

### Task 3: DOM helpers, choice builder and digits exercise

**Files:**
- Create: `js/ui/dom.js`, `js/ui/choice-buttons.js`, `js/exercises/choices.js`, `js/exercises/digits.js`
- Test: `tests/unit/choices.test.js`, `tests/unit/digits.test.js`

**Interfaces:**
- Consumes: `randInt`, `shuffle` from `js/rng.js`.
- Produces:
  - `h(tag, props = {}, ...children) → HTMLElement` (props: `class`, `dataset`, `html`, `on<Event>` handlers, other keys as attributes; `null`/`false` skipped; arrays flattened). `wait(ms) → Promise`.
  - `renderChoiceButtons(el, choices, label, onPick) → HTMLButtonElement[]` – container class `choices cols-<min(n,5)>`, each button `.choice` with `data-value`, fires `onPick(value, button)` once, then disables all.
  - `buildChoices(answer, preferred, pool, count, rng) → array` (shuffled, contains answer, unique, all from pool, length `min(count, pool.length)`).
  - digits module per exercise contract; `stages(settings)` returns upper bounds `[5, 9, 10, 20]` filtered by `settings.digits.range`.

- [ ] **Step 1: Write failing tests**

`tests/unit/choices.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChoices } from '../../js/exercises/choices.js';
import { mulberry32 } from '../../js/rng.js';

const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

test('returns count unique values including the answer', () => {
  const c = buildChoices(4, [], pool, 4, mulberry32(1));
  assert.equal(c.length, 4);
  assert.equal(new Set(c).size, 4);
  assert.ok(c.includes(4));
});

test('preferred distractors are used first', () => {
  const c = buildChoices(6, [9, 5], pool, 3, mulberry32(2));
  assert.deepEqual([...c].sort(), [5, 6, 9]);
});

test('preferred values outside the pool and the answer itself are ignored', () => {
  const c = buildChoices(6, [6, 42, -1, 9], pool, 2, mulberry32(3));
  assert.deepEqual([...c].sort(), [6, 9]);
});

test('a pool smaller than count yields the whole pool', () => {
  const c = buildChoices('A', [], ['A', 'B'], 4, mulberry32(4));
  assert.deepEqual([...c].sort(), ['A', 'B']);
});
```

`tests/unit/digits.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as digits from '../../js/exercises/digits.js';
import { mulberry32 } from '../../js/rng.js';

const S = (range = 20) => ({ digits: { range } });
const task = (complexity, seed, range = 20) =>
  digits.createTask({ complexity }, S(range), mulberry32(seed));

test('stages are limited by the configured range', () => {
  assert.deepEqual(digits.stages(S(9)), [5, 9]);
  assert.deepEqual(digits.stages(S(10)), [5, 9, 10]);
  assert.deepEqual(digits.stages(S(20)), [5, 9, 10, 20]);
  assert.equal(digits.maxComplexity(S(10)), 2);
  assert.equal(digits.startComplexity(S(10)), 0);
});

test('answer lies in the stage range and is among 4 unique in-range choices', () => {
  const his = [5, 9, 10, 20];
  for (let c = 0; c < 4; c++) {
    for (let seed = 0; seed < 200; seed++) {
      const t = task(c, seed);
      assert.ok(t.answer >= 0 && t.answer <= his[c]);
      assert.equal(t.choices.length, 4);
      assert.equal(new Set(t.choices).size, 4);
      assert.ok(t.choices.includes(t.answer));
      assert.ok(t.choices.every((v) => v >= 0 && v <= his[c]));
      assert.equal(t.stimulus.text, String(t.answer));
      assert.equal(t.exercise, 'digits');
    }
  }
});

test('complexity above the range is capped', () => {
  for (let seed = 0; seed < 100; seed++) assert.ok(task(3, seed, 9).answer <= 9);
});

test('confusable digits are preferred: 6 comes with 9', () => {
  let seen = 0;
  for (let seed = 0; seed < 500 && seen < 5; seed++) {
    const t = task(1, seed);
    if (t.answer === 6) { assert.ok(t.choices.includes(9)); seen++; }
  }
  assert.ok(seen > 0);
});

test('reversed numbers outside the range are never offered', () => {
  for (let seed = 0; seed < 2000; seed++) {
    const t = task(3, seed);
    assert.ok(t.choices.every((v) => v <= 20));
  }
});

test('the reversed number is preferred when it stays in range (20 → 2)', () => {
  for (let seed = 0; seed < 3000; seed++) {
    const t = task(3, seed);
    if (t.answer === 20) { assert.ok(t.choices.includes(2)); return; }
  }
  assert.fail('no task with answer 20 found');
});

test('prompt and solution texts', () => {
  const t = task(0, 1);
  assert.equal(digits.speakPrompt(t, S()), 'Welche Zahl war das?');
  assert.equal(digits.speakSolution(t, S()), `Das war die ${t.answer}.`);
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`js/ui/dom.js`:
```js
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : String(c));
  }
  return el;
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
```

`js/ui/choice-buttons.js`:
```js
import { h } from './dom.js';

export function renderChoiceButtons(el, choices, label, onPick) {
  let done = false;
  const buttons = choices.map((value) => {
    const btn = h('button', { class: 'choice', type: 'button', 'data-value': String(value) }, label(value));
    btn.addEventListener('click', () => {
      if (done) return;
      done = true;
      buttons.forEach((b) => { b.disabled = true; });
      onPick(value, btn);
    });
    return btn;
  });
  el.replaceChildren(h('div', { class: `choices cols-${Math.min(choices.length, 5)}` }, buttons));
  return buttons;
}
```

`js/exercises/choices.js`:
```js
import { shuffle } from '../rng.js';

export function buildChoices(answer, preferred, pool, count, rng) {
  const target = Math.min(count, pool.length) - 1;
  const picked = [];
  const add = (v) => {
    if (picked.length < target && v !== answer && pool.includes(v) && !picked.includes(v)) picked.push(v);
  };
  preferred.forEach(add);
  shuffle(rng, pool).forEach(add);
  return shuffle(rng, [answer, ...picked]);
}
```

`js/exercises/digits.js`:
```js
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
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ui/dom.js js/ui/choice-buttons.js js/exercises/choices.js js/exercises/digits.js tests/unit/choices.test.js tests/unit/digits.test.js
git commit -m "feat: add digits exercise and choice helpers"
```

---

### Task 4: Letters exercise

**Files:**
- Create: `js/exercises/letters.js`
- Test: `tests/unit/letters.test.js`

**Interfaces:**
- Consumes: `pick`, `buildChoices`, `h`, `renderChoiceButtons`.
- Produces: letters module per contract plus `LETTERS` (array `A`–`Z`, `Ä`, `Ö`, `Ü`, `ß`), `NAMES`, `SOUNDS`. Task shape adds `base` (uppercase base letter, or `ß`). `stages(settings)` = `CASE_STAGES[settings.letters.case]` where `upper → ['upper']`, `lower → ['lower']`, `both → ['upper','lower','mixed']`.

- [ ] **Step 1: Write failing tests**

`tests/unit/letters.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as letters from '../../js/exercises/letters.js';
import { mulberry32 } from '../../js/rng.js';

const S = (known, c = 'upper', speak = 'sound') => ({ letters: { known, case: c, speak } });
const make = (settings, complexity, seed) => letters.createTask({ complexity }, settings, mulberry32(seed));

test('alphabet contains umlauts and ß', () => {
  assert.equal(letters.LETTERS.length, 30);
  for (const l of ['A', 'Z', 'Ä', 'Ö', 'Ü', 'ß']) assert.ok(letters.LETTERS.includes(l));
});

test('available only with at least two known letters', () => {
  assert.equal(letters.isAvailable(S(['A'])), false);
  assert.equal(letters.isAvailable(S(['A', 'M'])), true);
});

test('answer and choices come only from known letters', () => {
  const s = S(['A', 'M', 'O', 'T', 'E']);
  for (let seed = 0; seed < 300; seed++) {
    const t = make(s, 0, seed);
    assert.ok(['A', 'M', 'O', 'T', 'E'].includes(t.answer));
    assert.equal(t.choices.length, 4);
    assert.equal(new Set(t.choices).size, 4);
    assert.ok(t.choices.includes(t.answer));
    assert.ok(t.choices.every((c) => ['A', 'M', 'O', 'T', 'E'].includes(c)));
  }
});

test('fewer known letters means fewer choices, at least two', () => {
  const t = make(S(['A', 'M']), 0, 1);
  assert.equal(t.choices.length, 2);
  assert.equal(make(S(['A', 'M', 'O']), 0, 1).choices.length, 3);
});

test('unknown entries in settings are ignored', () => {
  for (let seed = 0; seed < 50; seed++) {
    const t = make(S(['A', 'M', '7', 'xx']), 0, seed);
    assert.ok(['A', 'M'].includes(t.answer));
  }
});

test('lower case shows lower-case glyphs', () => {
  const t = make(S(['A', 'M', 'Ä', 'ß'], 'lower'), 0, 3);
  assert.ok(['a', 'm', 'ä', 'ß'].includes(t.answer));
  assert.ok(t.choices.every((c) => ['a', 'm', 'ä', 'ß'].includes(c)));
  assert.equal(t.stimulus.text, t.answer);
});

test('stages follow the case setting', () => {
  assert.deepEqual(letters.stages(S(['A', 'B'], 'upper')), ['upper']);
  assert.deepEqual(letters.stages(S(['A', 'B'], 'both')), ['upper', 'lower', 'mixed']);
  assert.equal(letters.maxComplexity(S(['A', 'B'], 'both')), 2);
});

test('mixed stage keeps stimulus and choices in the same case', () => {
  const s = S(['A', 'B', 'D', 'M', 'O'], 'both');
  for (let seed = 0; seed < 200; seed++) {
    const t = make(s, 2, seed);
    const upper = t.answer === t.answer.toUpperCase();
    assert.ok(t.choices.every((c) => (c === c.toUpperCase()) === upper));
  }
});

test('confusable letters are preferred as distractors (b/d/p/q)', () => {
  const s = S(['B', 'D', 'P', 'Q', 'A', 'M', 'O', 'T'], 'lower');
  let seen = 0;
  for (let seed = 0; seed < 400; seed++) {
    const t = make(s, 0, seed);
    if (t.base === 'B') { assert.deepEqual([...t.choices].sort(), ['b', 'd', 'p', 'q']); seen++; }
  }
  assert.ok(seen > 0);
});

test('solution text uses sound or name', () => {
  const t = { base: 'M', answer: 'M' };
  assert.equal(letters.speakSolution(t, S(['M', 'A'], 'upper', 'sound')), 'Das war mmm.');
  assert.equal(letters.speakSolution(t, S(['M', 'A'], 'upper', 'name')), 'Das war ein Em.');
  assert.equal(letters.speakPrompt(t, S(['M', 'A'])), 'Welcher Buchstabe war das?');
});

test('every letter has a name and a sound', () => {
  for (const l of letters.LETTERS) {
    assert.ok(letters.NAMES[l], `name ${l}`);
    assert.ok(letters.SOUNDS[l], `sound ${l}`);
  }
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`js/exercises/letters.js`:
```js
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
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/exercises/letters.js tests/unit/letters.test.js
git commit -m "feat: add letters exercise with confusion-based distractors"
```

---

### Task 5: Quantity exercise and layouts

**Files:**
- Create: `js/exercises/quantity-layout.js`, `js/exercises/quantity.js`
- Test: `tests/unit/quantity.test.js`

**Interfaces:**
- Consumes: `randInt`, `pick`, `shuffle`, `h`, `renderChoiceButtons`.
- Produces:
  - `MIN_DIST = 0.18`; `layoutPositions(count, mode, rng) → [{ x, y }]` in unit square, `mode` `'structured' | 'random'`.
  - quantity module per contract plus `OBJECTS = ['apple','ball','star','fish','flower','car']`, `MAXES = [3,4,5,6,8,10]`, `prepareRound(rng) → { object }`. Stage = `{ max, layout }`. Task stimulus `{ count, object, positions }`, `answer = count`, `choices = [1..max]`.

- [ ] **Step 1: Write failing tests**

`tests/unit/quantity.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as quantity from '../../js/exercises/quantity.js';
import { layoutPositions, MIN_DIST } from '../../js/exercises/quantity-layout.js';
import { mulberry32 } from '../../js/rng.js';

const S = (max = 10, layout = 'mixed') => ({ quantity: { max, layout } });
const minDistance = (pts) => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  return m;
};

test('mixed stages go structured then mixed for each max', () => {
  assert.deepEqual(quantity.stages(S(5, 'mixed')), [
    { max: 3, layout: 'structured' }, { max: 3, layout: 'mixed' },
    { max: 4, layout: 'structured' }, { max: 4, layout: 'mixed' },
    { max: 5, layout: 'structured' }, { max: 5, layout: 'mixed' },
  ]);
});

test('structured and random settings use a single layout', () => {
  assert.ok(quantity.stages(S(10, 'structured')).every((s) => s.layout === 'structured'));
  assert.ok(quantity.stages(S(10, 'random')).every((s) => s.layout === 'random'));
  assert.equal(quantity.stages(S(10, 'random')).length, 6);
});

test('start complexity is the first stage with max 5', () => {
  assert.equal(quantity.startComplexity(S(10, 'mixed')), 4);
  assert.equal(quantity.startComplexity(S(10, 'random')), 2);
  assert.equal(quantity.startComplexity(S(3, 'mixed')), 1);
});

test('count is within 1..max and choices are 1..max', () => {
  const s = S(10, 'mixed');
  for (let c = 0; c <= quantity.maxComplexity(s); c++) {
    const { max } = quantity.stages(s)[c];
    for (let seed = 0; seed < 100; seed++) {
      const t = quantity.createTask({ complexity: c }, s, mulberry32(seed), { object: 'apple' });
      assert.ok(t.answer >= 1 && t.answer <= max);
      assert.equal(t.stimulus.count, t.answer);
      assert.equal(t.stimulus.positions.length, t.answer);
      assert.deepEqual(t.choices, Array.from({ length: max }, (_, i) => i + 1));
      assert.equal(t.stimulus.object, 'apple');
    }
  }
});

test('structured layouts have the right count and do not overlap', () => {
  for (let n = 1; n <= 10; n++) {
    const pts = layoutPositions(n, 'structured', mulberry32(n));
    assert.equal(pts.length, n);
    if (n > 1) assert.ok(minDistance(pts) >= MIN_DIST - 1e-9, `n=${n}`);
  }
});

test('random layouts keep minimum distance and stay inside the field', () => {
  for (let seed = 0; seed < 300; seed++) {
    const pts = layoutPositions(10, 'random', mulberry32(seed));
    assert.equal(pts.length, 10);
    assert.ok(minDistance(pts) >= MIN_DIST - 1e-9);
    assert.ok(pts.every((p) => p.x >= 0.05 && p.x <= 0.95 && p.y >= 0.05 && p.y <= 0.95));
  }
});

test('prepareRound picks one of the objects', () => {
  assert.ok(quantity.OBJECTS.includes(quantity.prepareRound(mulberry32(1)).object));
});

test('texts', () => {
  assert.equal(quantity.speakPrompt(), 'Wie viele waren es?');
  assert.equal(quantity.speakSolution({ answer: 1 }), 'Es war einer.');
  assert.equal(quantity.speakSolution({ answer: 6 }), 'Es waren 6.');
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`js/exercises/quantity-layout.js`:
```js
import { shuffle } from '../rng.js';

export const MIN_DIST = 0.18;

const DICE = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.3], [0.7, 0.7]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
};

function tenFrame(count) {
  return Array.from({ length: count }, (_, i) => [0.1 + (i % 5) * 0.2, i < 5 ? 0.38 : 0.62]);
}

function jitteredGrid(count, rng) {
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cells.push([0.2 + c * 0.2, 0.2 + r * 0.2]);
  return shuffle(rng, cells).slice(0, count).map(([x, y]) => [x + (rng() - 0.5) * 0.018, y + (rng() - 0.5) * 0.018]);
}

function randomPositions(count, rng) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const pts = [];
    for (let tries = 0; pts.length < count && tries < 500; tries++) {
      const p = [0.1 + rng() * 0.8, 0.1 + rng() * 0.8];
      if (pts.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= MIN_DIST)) pts.push(p);
    }
    if (pts.length === count) return pts;
  }
  return jitteredGrid(count, rng);
}

export function layoutPositions(count, mode, rng) {
  const raw = mode === 'random' ? randomPositions(count, rng) : count <= 6 ? DICE[count] : tenFrame(count);
  return raw.map(([x, y]) => ({ x, y }));
}
```

`js/exercises/quantity.js`:
```js
import { randInt, pick } from '../rng.js';
import { layoutPositions } from './quantity-layout.js';
import { h } from '../ui/dom.js';
import { renderChoiceButtons } from '../ui/choice-buttons.js';

export const id = 'quantity';
export const title = 'Mengen';
export const OBJECTS = ['apple', 'ball', 'star', 'fish', 'flower', 'car'];
export const MAXES = [3, 4, 5, 6, 8, 10];
const LAYOUT_LABELS = { structured: 'strukturiert', random: 'zufällig', mixed: 'gemischt' };

export function isAvailable() { return true; }

export function stages(settings) {
  const maxes = MAXES.filter((m) => m <= settings.quantity.max);
  const list = maxes.length ? maxes : [3];
  const layout = settings.quantity.layout;
  if (layout === 'structured' || layout === 'random') return list.map((max) => ({ max, layout }));
  return list.flatMap((max) => [{ max, layout: 'structured' }, { max, layout: 'mixed' }]);
}

export function maxComplexity(settings) { return stages(settings).length - 1; }

export function startComplexity(settings) {
  const s = stages(settings);
  const i = s.findIndex((st) => st.max === 5);
  return i >= 0 ? i : s.length - 1;
}

export function describeLevel(complexity, settings) {
  const s = stages(settings);
  const st = s[Math.min(complexity, s.length - 1)];
  return `bis ${st.max}, ${LAYOUT_LABELS[st.layout]}`;
}

export function prepareRound(rng) { return { object: pick(rng, OBJECTS) }; }

export function createTask(level, settings, rng, roundCtx = { object: OBJECTS[0] }) {
  const s = stages(settings);
  const st = s[Math.min(level.complexity, s.length - 1)];
  const count = randInt(rng, 1, st.max);
  const mode = st.layout === 'mixed' ? (rng() < 0.5 ? 'structured' : 'random') : st.layout;
  return {
    exercise: id,
    stimulus: { count, object: roundCtx.object, positions: layoutPositions(count, mode, rng) },
    answer: count,
    choices: Array.from({ length: st.max }, (_, i) => i + 1),
  };
}

export function renderStimulus(task, el) {
  const field = h('div', { class: 'field' });
  for (const p of task.stimulus.positions) {
    field.append(h('img', {
      class: 'obj',
      src: `assets/objects/${task.stimulus.object}.svg`,
      alt: '',
      style: `left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%`,
    }));
  }
  el.replaceChildren(field);
}

function dots(n) {
  return h('span', { class: 'dots', 'aria-hidden': 'true' },
    h('span', {}, '•'.repeat(Math.min(n, 5))),
    n > 5 ? h('span', {}, '•'.repeat(n - 5)) : null);
}

export function renderChoices(task, el, onPick) {
  return renderChoiceButtons(el, task.choices, (v) => [h('span', { class: 'num' }, String(v)), dots(v)], onPick);
}

export function speakPrompt() { return 'Wie viele waren es?'; }
export function speakSolution(task) { return task.answer === 1 ? 'Es war einer.' : `Es waren ${task.answer}.`; }
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/exercises/quantity.js js/exercises/quantity-layout.js tests/unit/quantity.test.js
git commit -m "feat: add quantity exercise with structured and random layouts"
```

---

### Task 6: Exercise registry and profiles

**Files:**
- Create: `js/exercises/index.js`, `js/profiles.js`
- Test: `tests/unit/profiles.test.js`

**Interfaces:**
- Consumes: exercise modules; `initialLevel`, `clampLevel` from adaptive.
- Produces:
  - `EXERCISES = { quantity, digits, letters }`, `EXERCISE_ORDER = ['quantity','digits','letters']`.
  - `AVATARS = ['fox','bear','cat','owl','rabbit','frog']`, `AVATAR_LABELS`, `DEFAULT_SETTINGS`.
  - `createProfile({ name, avatar }, { now, id } = {}) → profile`
  - `getActive(state)`, `addProfile(state, profile)`, `setActive(state, id)`, `updateProfile(state, id, fn)`, `removeProfile(state, id)` – all return new state.
  - `updateSettings(profile, patch) → profile` (deep merge, arrays replaced, timing normalized, levels clamped)
  - `resetLevels(profile) → profile`, `normalizeProfile(raw) → profile`, `mergeDeep(base, patch)`.

- [ ] **Step 1: Write failing tests**

`tests/unit/profiles.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, EXERCISE_ORDER } from '../../js/exercises/index.js';
import {
  DEFAULT_SETTINGS, createProfile, addProfile, removeProfile, setActive, getActive,
  updateProfile, updateSettings, resetLevels, normalizeProfile,
} from '../../js/profiles.js';

const empty = () => ({ schemaVersion: 1, activeProfileId: null, profiles: [] });
const mk = (id, name = 'Mia') => createProfile({ name, avatar: 'fox' }, { id, now: new Date(2026, 9, 3) });

test('every exercise implements the module contract', () => {
  const fns = ['isAvailable', 'stages', 'maxComplexity', 'startComplexity', 'describeLevel', 'createTask', 'renderStimulus', 'renderChoices', 'speakPrompt', 'speakSolution'];
  assert.deepEqual(Object.keys(EXERCISES).sort(), [...EXERCISE_ORDER].sort());
  for (const [key, ex] of Object.entries(EXERCISES)) {
    assert.equal(ex.id, key);
    assert.equal(typeof ex.title, 'string');
    for (const f of fns) assert.equal(typeof ex[f], 'function', `${key}.${f}`);
  }
});

test('createProfile uses defaults, trims the name and creates a level per exercise', () => {
  const p = createProfile({ name: '  Mia ', avatar: 'cat' }, { id: 'p1', now: new Date(2026, 9, 3) });
  assert.equal(p.name, 'Mia');
  assert.equal(p.avatar, 'cat');
  assert.deepEqual(p.settings, DEFAULT_SETTINGS);
  assert.notEqual(p.settings, DEFAULT_SETTINGS);
  assert.equal(p.levels.quantity.complexity, 4);
  assert.equal(p.levels.digits.durationMs, 1500);
  assert.deepEqual(p.rewards, { stars: 0, stickers: [], unlockedPages: 1 });
  assert.deepEqual(p.history, []);
});

test('createProfile generates distinct ids', () => {
  assert.notEqual(createProfile({ name: 'A', avatar: 'fox' }).id, createProfile({ name: 'B', avatar: 'fox' }).id);
});

test('addProfile activates the first profile only', () => {
  let s = addProfile(empty(), mk('p1'));
  assert.equal(s.activeProfileId, 'p1');
  s = addProfile(s, mk('p2', 'Ben'));
  assert.equal(s.activeProfileId, 'p1');
  assert.equal(setActive(s, 'p2').activeProfileId, 'p2');
  assert.equal(getActive(setActive(s, 'p2')).name, 'Ben');
});

test('removing the active profile activates the next one, removing the last leaves none', () => {
  let s = addProfile(addProfile(empty(), mk('p1')), mk('p2'));
  s = removeProfile(s, 'p1');
  assert.equal(s.activeProfileId, 'p2');
  s = removeProfile(s, 'p2');
  assert.equal(s.activeProfileId, null);
  assert.equal(getActive(s), null);
});

test('updateProfile changes only the target profile', () => {
  const s = addProfile(addProfile(empty(), mk('p1')), mk('p2', 'Ben'));
  const next = updateProfile(s, 'p2', (p) => ({ ...p, name: 'Benno' }));
  assert.equal(next.profiles[0].name, 'Mia');
  assert.equal(next.profiles[1].name, 'Benno');
});

test('updateSettings merges nested values and replaces arrays', () => {
  const p = updateSettings(mk('p1'), { letters: { known: ['B', 'D'] }, timing: { startMs: 1000 } });
  assert.deepEqual(p.settings.letters.known, ['B', 'D']);
  assert.equal(p.settings.letters.case, 'upper');
  assert.equal(p.settings.timing.startMs, 1000);
  assert.equal(p.settings.timing.maxMs, 3000);
});

test('updateSettings normalizes timing so that min ≤ start ≤ max', () => {
  const p = updateSettings(mk('p1'), { timing: { startMs: 4000, minMs: 3500, maxMs: 2000 } });
  assert.deepEqual([p.settings.timing.minMs, p.settings.timing.startMs, p.settings.timing.maxMs], [2000, 3500, 3500]);
});

test('updateSettings clamps levels when the parent lowers limits', () => {
  let p = mk('p1');
  p = { ...p, levels: { ...p.levels, quantity: { ...p.levels.quantity, complexity: 11, durationMs: 300 } } };
  p = updateSettings(p, { quantity: { max: 5 }, timing: { minMs: 500 } });
  assert.equal(p.levels.quantity.complexity, 5);
  assert.equal(p.levels.quantity.durationMs, 500);
});

test('resetLevels returns to start values', () => {
  let p = mk('p1');
  p = { ...p, levels: { ...p.levels, digits: { durationMs: 300, complexity: 1, streak: 2, recent: [true] } } };
  assert.deepEqual(resetLevels(p).levels.digits, { durationMs: 1500, complexity: 0, streak: 0, recent: [] });
});

test('normalizeProfile fills missing settings, levels and rewards', () => {
  const raw = mk('p1');
  delete raw.settings.sounds;
  delete raw.levels.letters;
  raw.avatar = 'dragon';
  const p = normalizeProfile(raw);
  assert.equal(p.settings.sounds, true);
  assert.ok(p.levels.letters);
  assert.equal(p.avatar, 'fox');
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`js/exercises/index.js`:
```js
import * as quantity from './quantity.js';
import * as digits from './digits.js';
import * as letters from './letters.js';

export const EXERCISES = { quantity, digits, letters };
export const EXERCISE_ORDER = ['quantity', 'digits', 'letters'];
```

`js/profiles.js`:
```js
import { EXERCISES } from './exercises/index.js';
import { initialLevel, clampLevel } from './adaptive.js';

export const AVATARS = ['fox', 'bear', 'cat', 'owl', 'rabbit', 'frog'];
export const AVATAR_LABELS = { fox: 'Fuchs', bear: 'Bär', cat: 'Katze', owl: 'Eule', rabbit: 'Hase', frog: 'Frosch' };

export const DEFAULT_SETTINGS = {
  exercises: { quantity: true, digits: true, letters: true },
  timing: { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: true },
  quantity: { max: 10, layout: 'mixed' },
  digits: { range: 9 },
  letters: { known: ['A', 'M', 'O'], case: 'upper', speak: 'sound' },
  speech: true,
  sounds: true,
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function mergeDeep(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    out[k] = isObj(v) && isObj(base?.[k]) ? mergeDeep(base[k], v) : structuredClone(v);
  }
  return out;
}

function normalizeTiming(t) {
  const minMs = Math.min(t.minMs, t.maxMs);
  const maxMs = Math.max(t.minMs, t.maxMs);
  return { ...t, minMs, maxMs, startMs: Math.min(maxMs, Math.max(minMs, t.startMs)) };
}

function normalizeSettings(settings) {
  return { ...settings, timing: normalizeTiming(settings.timing) };
}

function buildLevels(levels, settings) {
  return Object.fromEntries(Object.entries(EXERCISES).map(([key, ex]) => [
    key,
    levels?.[key]
      ? clampLevel(levels[key], settings.timing, ex.maxComplexity(settings))
      : initialLevel(settings.timing, ex.startComplexity(settings)),
  ]));
}

let counter = 0;
export function newId() {
  counter += 1;
  return `p_${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createProfile({ name, avatar }, { now = new Date(), id = newId() } = {}) {
  const settings = structuredClone(DEFAULT_SETTINGS);
  return {
    id,
    name: String(name).trim(),
    avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0],
    createdAt: now.toISOString(),
    settings,
    levels: buildLevels(null, settings),
    rewards: { stars: 0, stickers: [], unlockedPages: 1 },
    history: [],
  };
}

export function normalizeProfile(raw) {
  const settings = normalizeSettings(mergeDeep(DEFAULT_SETTINGS, raw.settings));
  return {
    ...raw,
    avatar: AVATARS.includes(raw.avatar) ? raw.avatar : AVATARS[0],
    settings,
    levels: buildLevels(raw.levels ?? {}, settings),
    rewards: { stars: 0, stickers: [], unlockedPages: 1, ...raw.rewards },
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

export function getActive(state) {
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? null;
}

export function addProfile(state, profile) {
  return { ...state, profiles: [...state.profiles, profile], activeProfileId: state.activeProfileId ?? profile.id };
}

export function setActive(state, id) {
  return { ...state, activeProfileId: id };
}

export function updateProfile(state, id, fn) {
  return { ...state, profiles: state.profiles.map((p) => (p.id === id ? fn(p) : p)) };
}

export function removeProfile(state, id) {
  const profiles = state.profiles.filter((p) => p.id !== id);
  const activeProfileId = state.activeProfileId === id ? (profiles[0]?.id ?? null) : state.activeProfileId;
  return { ...state, profiles, activeProfileId };
}

export function updateSettings(profile, patch) {
  const settings = normalizeSettings(mergeDeep(profile.settings, patch));
  return { ...profile, settings, levels: buildLevels(profile.levels, settings) };
}

export function resetLevels(profile) {
  return { ...profile, levels: buildLevels(null, profile.settings) };
}
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/exercises/index.js js/profiles.js tests/unit/profiles.test.js
git commit -m "feat: add exercise registry and profile management"
```

---

### Task 7: Storage, migration, import/export

**Files:**
- Create: `js/storage.js`
- Test: `tests/unit/storage.test.js`

**Interfaces:**
- Consumes: `normalizeProfile` from profiles, `localDate` from util.
- Produces:
  - `STORAGE_KEY`, `SCHEMA_VERSION`, `HISTORY_DAYS`, `class ImportError extends Error`
  - `emptyState()`, `migrate(data) → state` (throws `ImportError`), `parseImport(text) → state`, `serializeExport(state) → string`, `exportFilename(date) → string`, `pruneHistory(state, today) → state`, `memoryBackend()`
  - `createStore(backend?) → { available, warnings, load(), save(state, today?), importText(text) → state }`; warnings values `'unavailable' | 'corrupt'`.

- [ ] **Step 1: Write failing tests**

`tests/unit/storage.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, ImportError, emptyState, migrate, parseImport, serializeExport, exportFilename,
  pruneHistory, memoryBackend, createStore,
} from '../../js/storage.js';
import { createProfile, addProfile } from '../../js/profiles.js';

const stateWith = (...names) => names.reduce(
  (s, n, i) => addProfile(s, createProfile({ name: n, avatar: 'fox' }, { id: `p${i + 1}` })),
  emptyState(),
);

test('load returns an empty state when nothing is stored', () => {
  assert.deepEqual(createStore(memoryBackend()).load(), emptyState());
});

test('save then load round-trips the state', () => {
  const b = memoryBackend();
  const s = stateWith('Mia');
  createStore(b).save(s);
  assert.deepEqual(createStore(b).load(), s);
});

test('export then import round-trips the state', () => {
  const s = stateWith('Mia', 'Ben');
  assert.deepEqual(parseImport(serializeExport(s)), s);
});

test('invalid JSON is rejected with a German message', () => {
  assert.throws(() => parseImport('nope'), (e) => e instanceof ImportError && /keine gültige/.test(e.message));
});

test('JSON that is not a backup is rejected', () => {
  assert.throws(() => parseImport('{"foo":1}'), ImportError);
  assert.throws(() => parseImport('{"schemaVersion":1,"profiles":[{"id":1}]}'), ImportError);
});

test('a backup from a newer version is rejected', () => {
  assert.throws(() => parseImport('{"schemaVersion":2,"profiles":[]}'), (e) => /neueren Version/.test(e.message));
});

test('migrate fills defaults and repairs an unknown active profile', () => {
  const s = stateWith('Mia');
  delete s.profiles[0].settings.speech;
  s.activeProfileId = 'gone';
  const m = migrate(s);
  assert.equal(m.profiles[0].settings.speech, true);
  assert.equal(m.activeProfileId, 'p1');
});

test('corrupt stored data is backed up and replaced by an empty state', () => {
  const b = memoryBackend();
  b.setItem(STORAGE_KEY, '{broken');
  const store = createStore(b);
  assert.deepEqual(store.load(), emptyState());
  assert.ok(store.warnings.includes('corrupt'));
  assert.ok(b.keys().some((k) => k.startsWith('blitzblick.corrupt-')));
});

test('an unusable backend falls back to memory and reports it', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  const store = createStore(broken);
  assert.equal(store.available, false);
  assert.ok(store.warnings.includes('unavailable'));
  const s = stateWith('Mia');
  store.save(s);
  assert.deepEqual(store.load(), s);
});

test('importText keeps a backup of the previous state', () => {
  const b = memoryBackend();
  const store = createStore(b);
  store.save(stateWith('Mia'));
  const imported = store.importText(serializeExport(stateWith('Ben')));
  assert.equal(imported.profiles[0].name, 'Ben');
  assert.equal(JSON.parse(b.getItem('blitzblick.pre-import')).profiles[0].name, 'Mia');
  assert.equal(store.load().profiles[0].name, 'Ben');
});

test('importText with an invalid file leaves the stored state untouched', () => {
  const b = memoryBackend();
  const store = createStore(b);
  store.save(stateWith('Mia'));
  assert.throws(() => store.importText('nope'), ImportError);
  assert.equal(store.load().profiles[0].name, 'Mia');
});

test('pruneHistory drops entries older than 90 days', () => {
  const s = stateWith('Mia');
  s.profiles[0].history = [
    { date: '2026-07-04', exercise: 'digits', correct: 5, total: 10, confusions: {} },
    { date: '2026-07-05', exercise: 'digits', correct: 5, total: 10, confusions: {} },
  ];
  const pruned = pruneHistory(s, new Date(2026, 9, 3));
  assert.deepEqual(pruned.profiles[0].history.map((h) => h.date), ['2026-07-05']);
});

test('exportFilename uses the local date', () => {
  assert.equal(exportFilename(new Date(2026, 9, 3, 23, 30)), 'blitzblick-backup-2026-10-03.json');
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`js/storage.js`:
```js
import { normalizeProfile } from './profiles.js';
import { localDate } from './util.js';

export const STORAGE_KEY = 'blitzblick.v1';
export const SCHEMA_VERSION = 1;
export const HISTORY_DAYS = 90;
const PRE_IMPORT_KEY = 'blitzblick.pre-import';

export class ImportError extends Error {}

export function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, activeProfileId: null, profiles: [] };
}

function validProfile(p) {
  return p && typeof p.id === 'string' && typeof p.name === 'string'
    && p.settings && typeof p.settings === 'object'
    && p.levels && typeof p.levels === 'object'
    && p.rewards && typeof p.rewards === 'object'
    && Array.isArray(p.history);
}

export function migrate(data) {
  if (!data || typeof data !== 'object' || typeof data.schemaVersion !== 'number' || !Array.isArray(data.profiles)) {
    throw new ImportError('Die Datei ist keine Blitzblick-Sicherung.');
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new ImportError('Die Sicherung stammt aus einer neueren Version der App. Bitte zuerst die App aktualisieren.');
  }
  if (!data.profiles.every(validProfile)) {
    throw new ImportError('Die Sicherung ist unvollständig oder beschädigt.');
  }
  // Future schema upgrades go here: if (data.schemaVersion === 1) data = upgradeV1toV2(data);
  const profiles = structuredClone(data.profiles).map(normalizeProfile);
  const activeProfileId = profiles.some((p) => p.id === data.activeProfileId) ? data.activeProfileId : (profiles[0]?.id ?? null);
  return { schemaVersion: SCHEMA_VERSION, activeProfileId, profiles };
}

export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('Die Datei ist keine gültige Sicherungsdatei.');
  }
  return migrate(data);
}

export function serializeExport(state) {
  return JSON.stringify(state, null, 2);
}

export function exportFilename(d = new Date()) {
  return `blitzblick-backup-${localDate(d)}.json`;
}

export function pruneHistory(state, today = new Date()) {
  const cutoff = localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - HISTORY_DAYS));
  return { ...state, profiles: state.profiles.map((p) => ({ ...p, history: p.history.filter((h) => h.date >= cutoff) })) };
}

export function memoryBackend() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    keys: () => [...m.keys()],
  };
}

function probe(backend) {
  try {
    backend.setItem('blitzblick.probe', '1');
    backend.removeItem('blitzblick.probe');
    return true;
  } catch {
    return false;
  }
}

export function createStore(backend) {
  if (backend === undefined) {
    try { backend = globalThis.localStorage ?? null; } catch { backend = null; }
  }
  const available = !!backend && probe(backend);
  const store = available ? backend : memoryBackend();
  const warnings = new Set(available ? [] : ['unavailable']);

  return {
    get available() { return available; },
    get warnings() { return [...warnings]; },
    load() {
      const raw = store.getItem(STORAGE_KEY);
      if (raw == null) return emptyState();
      try {
        return migrate(JSON.parse(raw));
      } catch {
        try { store.setItem(`blitzblick.corrupt-${Date.now()}`, raw); } catch { /* ignore */ }
        warnings.add('corrupt');
        return emptyState();
      }
    },
    save(state, today = new Date()) {
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(pruneHistory(state, today)));
      } catch {
        warnings.add('unavailable');
      }
    },
    importText(text) {
      const state = parseImport(text);
      const current = store.getItem(STORAGE_KEY);
      if (current != null) store.setItem(PRE_IMPORT_KEY, current);
      store.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    },
  };
}
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/unit/storage.test.js
git commit -m "feat: add storage with migration, import and export"
```

---

### Task 8: Rewards and album data

**Files:**
- Create: `js/rewards.js`
- Test: `tests/unit/rewards.test.js`

**Interfaces:**
- Consumes: `pick` from rng.
- Produces: `PAGES` (5 × `{ id, title, stickers[8] }`), `STARS_PER_PAGE = 50`, `BONUS_STARS = 3`, `stickerId(page, name) → 'page/name'`, `stickerUrl(id) → 'assets/stickers/<id>.svg'`, `unlockedPagesFor(stars)`, `missingStickers(rewards)`, `applyRoundRewards(rewards, correct, rng) → { rewards, sticker, bonusStars, newlyUnlockedPages }`.

- [ ] **Step 1: Write failing tests**

`tests/unit/rewards.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, unlockedPagesFor, applyRoundRewards, missingStickers, stickerUrl } from '../../js/rewards.js';
import { mulberry32 } from '../../js/rng.js';

const fresh = () => ({ stars: 0, stickers: [], unlockedPages: 1 });

test('five pages with eight unique stickers each', () => {
  assert.equal(PAGES.length, 5);
  for (const p of PAGES) assert.equal(new Set(p.stickers).size, 8);
});

test('a page unlocks every 50 stars, capped at the page count', () => {
  assert.equal(unlockedPagesFor(0), 1);
  assert.equal(unlockedPagesFor(49), 1);
  assert.equal(unlockedPagesFor(50), 2);
  assert.equal(unlockedPagesFor(10_000), 5);
});

test('a round adds one star per correct answer and one new sticker', () => {
  const r = applyRoundRewards(fresh(), 7, mulberry32(1));
  assert.equal(r.rewards.stars, 7);
  assert.equal(r.rewards.stickers.length, 1);
  assert.ok(r.sticker.startsWith('animals/'));
  assert.equal(r.bonusStars, 0);
});

test('a round with zero correct answers still gives a sticker', () => {
  assert.ok(applyRoundRewards(fresh(), 0, mulberry32(2)).sticker);
});

test('no duplicates until the unlocked pages are complete, then bonus stars', () => {
  const rng = mulberry32(3);
  let rewards = fresh();
  for (let i = 0; i < 8; i++) rewards = applyRoundRewards(rewards, 0, rng).rewards;
  assert.equal(new Set(rewards.stickers).size, 8);
  assert.deepEqual(missingStickers(rewards), []);
  const r = applyRoundRewards(rewards, 0, rng);
  assert.equal(r.sticker, null);
  assert.equal(r.bonusStars, 3);
  assert.equal(r.rewards.stars, 3);
});

test('reaching 50 stars unlocks the second page', () => {
  const r = applyRoundRewards({ stars: 45, stickers: [], unlockedPages: 1 }, 5, mulberry32(4));
  assert.equal(r.rewards.unlockedPages, 2);
  assert.deepEqual(r.newlyUnlockedPages, ['vehicles']);
});

test('bonus stars can unlock a page', () => {
  const all = PAGES[0].stickers.map((s) => `animals/${s}`);
  const r = applyRoundRewards({ stars: 48, stickers: all, unlockedPages: 1 }, 0, mulberry32(5));
  assert.equal(r.rewards.stars, 51);
  assert.deepEqual(r.newlyUnlockedPages, ['vehicles']);
});

test('input rewards are not mutated', () => {
  const before = fresh();
  applyRoundRewards(before, 5, mulberry32(6));
  assert.deepEqual(before, fresh());
});

test('stickerUrl', () => {
  assert.equal(stickerUrl('sea/fish'), 'assets/stickers/sea/fish.svg');
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`js/rewards.js`:
```js
import { pick } from './rng.js';

export const PAGES = [
  { id: 'animals', title: 'Tiere', stickers: ['lion', 'elephant', 'giraffe', 'monkey', 'penguin', 'turtle', 'zebra', 'hedgehog'] },
  { id: 'vehicles', title: 'Fahrzeuge', stickers: ['car', 'bus', 'train', 'plane', 'ship', 'bike', 'tractor', 'firetruck'] },
  { id: 'space', title: 'Weltraum', stickers: ['rocket', 'moon', 'sun', 'planet', 'star', 'astronaut', 'ufo', 'comet'] },
  { id: 'sea', title: 'Meer', stickers: ['fish', 'octopus', 'crab', 'whale', 'starfish', 'seahorse', 'jellyfish', 'shell'] },
  { id: 'dinos', title: 'Dinos', stickers: ['trex', 'stegosaurus', 'triceratops', 'brachiosaurus', 'pterodactyl', 'egg', 'volcano', 'footprint'] },
];
export const STARS_PER_PAGE = 50;
export const BONUS_STARS = 3;

export const stickerId = (page, name) => `${page}/${name}`;
export const stickerUrl = (id) => `assets/stickers/${id}.svg`;

export function unlockedPagesFor(stars) {
  return Math.min(PAGES.length, 1 + Math.floor(stars / STARS_PER_PAGE));
}

export function missingStickers(rewards) {
  return PAGES.slice(0, rewards.unlockedPages)
    .flatMap((p) => p.stickers.map((s) => stickerId(p.id, s)))
    .filter((id) => !rewards.stickers.includes(id));
}

export function applyRoundRewards(rewards, correct, rng) {
  let stars = rewards.stars + correct;
  let unlocked = Math.max(rewards.unlockedPages, unlockedPagesFor(stars));
  const missing = missingStickers({ ...rewards, unlockedPages: unlocked });
  let sticker = null;
  let bonusStars = 0;
  if (missing.length) {
    sticker = pick(rng, missing);
  } else {
    bonusStars = BONUS_STARS;
    stars += BONUS_STARS;
    unlocked = Math.max(unlocked, unlockedPagesFor(stars));
  }
  return {
    rewards: { stars, stickers: sticker ? [...rewards.stickers, sticker] : [...rewards.stickers], unlockedPages: unlocked },
    sticker,
    bonusStars,
    newlyUnlockedPages: PAGES.slice(rewards.unlockedPages, unlocked).map((p) => p.id),
  };
}
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/rewards.js tests/unit/rewards.test.js
git commit -m "feat: add sticker album and star rewards"
```

---

### Task 9: Round session logic

**Files:**
- Create: `js/session.js`
- Test: `tests/unit/session.test.js`

**Interfaces:**
- Consumes: `EXERCISES`, `recordResult`, `effectiveLevel`, `applyRoundRewards`, `localDate`.
- Produces:
  - `ROUND_LENGTH = 10`
  - `createRound(profile, exerciseId, rng) → round` (`{ exerciseId, level, ctx, results: [], task: null, durationMs: null, awaiting: false }`)
  - `nextTask(round, profile, rng) → round` (sets `task`, `durationMs`, `awaiting: true`)
  - `answerTask(round, profile, picked) → { round, correct, finished } | { round, ignored: true }`
  - `finishRound(profile, round, rng, now = new Date()) → { profile, reward }` (reward = result of `applyRoundRewards`)
  - `abortRound(profile, round) → profile`

- [ ] **Step 1: Write failing tests**

`tests/unit/session.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUND_LENGTH, createRound, nextTask, answerTask, finishRound, abortRound } from '../../js/session.js';
import { createProfile, updateSettings } from '../../js/profiles.js';
import { mulberry32 } from '../../js/rng.js';

const profile = () => createProfile({ name: 'Mia', avatar: 'fox' }, { id: 'p1', now: new Date(2026, 9, 3) });

function playAll(p, exerciseId, rng, answerFn = (t) => t.answer) {
  let r = createRound(p, exerciseId, rng);
  for (let i = 0; i < ROUND_LENGTH; i++) {
    r = nextTask(r, p, rng);
    r = answerTask(r, p, answerFn(r.task, i)).round;
  }
  return r;
}

test('a round has 10 tasks and finishes on the 10th answer', () => {
  const rng = mulberry32(3);
  const p = profile();
  let r = createRound(p, 'digits', rng);
  for (let i = 0; i < 10; i++) {
    r = nextTask(r, p, rng);
    const res = answerTask(r, p, r.task.answer);
    assert.equal(res.correct, true);
    assert.equal(res.finished, i === 9);
    r = res.round;
  }
});

test('double tap: a second answer to the same task is ignored', () => {
  const rng = mulberry32(4);
  const p = profile();
  let r = nextTask(createRound(p, 'digits', rng), p, rng);
  r = answerTask(r, p, r.task.answer).round;
  const again = answerTask(r, p, r.task.answer);
  assert.equal(again.ignored, true);
  assert.equal(again.round.results.length, 1);
});

test('nextTask uses the effective duration', () => {
  const rng = mulberry32(5);
  let p = profile();
  assert.equal(nextTask(createRound(p, 'digits', rng), p, rng).durationMs, 1500);
  p = updateSettings(p, { timing: { adaptive: false, startMs: 800 } });
  assert.equal(nextTask(createRound(p, 'digits', rng), p, rng).durationMs, 800);
});

test('three correct answers make the next task faster', () => {
  const rng = mulberry32(6);
  const p = profile();
  let r = createRound(p, 'digits', rng);
  for (let i = 0; i < 3; i++) {
    r = nextTask(r, p, rng);
    r = answerTask(r, p, r.task.answer).round;
  }
  assert.equal(nextTask(r, p, rng).durationMs, 1250);
});

test('finishRound stores level, rewards and a history entry with local date and confusions', () => {
  const rng = mulberry32(7);
  const p = profile();
  const r = playAll(p, 'digits', rng, (t, i) => (i < 2 ? (t.choices.find((c) => c !== t.answer)) : t.answer));
  const { profile: next, reward } = finishRound(p, r, rng, new Date(2026, 9, 3, 23, 50));
  assert.equal(next.rewards.stars, 8);
  assert.equal(next.rewards.stickers.length, 1);
  assert.ok(reward.sticker);
  assert.deepEqual(next.levels.digits, r.level);
  const h = next.history.at(-1);
  assert.equal(h.date, '2026-10-03');
  assert.equal(h.exercise, 'digits');
  assert.equal(h.correct, 8);
  assert.equal(h.total, 10);
  assert.equal(Object.values(h.confusions).reduce((a, b) => a + b, 0), 2);
  assert.ok(Object.keys(h.confusions).every((k) => /^\d+>\d+$/.test(k)));
});

test('abortRound keeps level changes but awards nothing', () => {
  const rng = mulberry32(8);
  const p = profile();
  let r = createRound(p, 'digits', rng);
  for (let i = 0; i < 3; i++) {
    r = nextTask(r, p, rng);
    r = answerTask(r, p, r.task.answer).round;
  }
  const next = abortRound(p, r);
  assert.equal(next.levels.digits.durationMs, 1250);
  assert.equal(next.rewards.stars, 0);
  assert.equal(next.history.length, 0);
});

test('quantity rounds keep one object for the whole round', () => {
  const rng = mulberry32(9);
  const p = profile();
  let r = createRound(p, 'quantity', rng);
  const objects = new Set();
  for (let i = 0; i < 10; i++) {
    r = nextTask(r, p, rng);
    objects.add(r.task.stimulus.object);
    r = answerTask(r, p, r.task.answer).round;
  }
  assert.equal(objects.size, 1);
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`js/session.js`:
```js
import { EXERCISES } from './exercises/index.js';
import { recordResult, effectiveLevel } from './adaptive.js';
import { applyRoundRewards } from './rewards.js';
import { localDate } from './util.js';

export const ROUND_LENGTH = 10;

export function createRound(profile, exerciseId, rng) {
  const ex = EXERCISES[exerciseId];
  return {
    exerciseId,
    level: profile.levels[exerciseId],
    ctx: ex.prepareRound ? ex.prepareRound(rng) : {},
    results: [],
    task: null,
    durationMs: null,
    awaiting: false,
  };
}

export function nextTask(round, profile, rng) {
  const ex = EXERCISES[round.exerciseId];
  const eff = effectiveLevel(round.level, profile.settings.timing, ex.maxComplexity(profile.settings));
  const task = ex.createTask({ ...round.level, complexity: eff.complexity }, profile.settings, rng, round.ctx);
  return { ...round, task, durationMs: eff.durationMs, awaiting: true };
}

export function answerTask(round, profile, picked) {
  if (!round.awaiting) return { round, ignored: true };
  const ex = EXERCISES[round.exerciseId];
  const correct = picked === round.task.answer;
  const level = recordResult(round.level, correct, profile.settings.timing, ex.maxComplexity(profile.settings));
  const results = [...round.results, { answer: round.task.answer, picked, correct }];
  return { round: { ...round, level, results, awaiting: false }, correct, finished: results.length >= ROUND_LENGTH };
}

export function finishRound(profile, round, rng, now = new Date()) {
  const correct = round.results.filter((r) => r.correct).length;
  const confusions = {};
  for (const r of round.results) {
    if (r.correct) continue;
    const key = `${r.answer}>${r.picked}`;
    confusions[key] = (confusions[key] ?? 0) + 1;
  }
  const reward = applyRoundRewards(profile.rewards, correct, rng);
  return {
    profile: {
      ...profile,
      levels: { ...profile.levels, [round.exerciseId]: round.level },
      rewards: reward.rewards,
      history: [...profile.history, { date: localDate(now), exercise: round.exerciseId, correct, total: round.results.length, confusions }],
    },
    reward,
  };
}

export function abortRound(profile, round) {
  return { ...profile, levels: { ...profile.levels, [round.exerciseId]: round.level } };
}
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/session.js tests/unit/session.test.js
git commit -m "feat: add round session logic"
```

---

### Task 10: Progress statistics

**Files:**
- Create: `js/stats.js`
- Test: `tests/unit/stats.test.js`

**Interfaces:**
- Consumes: `localDate`.
- Produces: `lastDays(today, n) → string[]` (oldest first), `summarize(history, exerciseId, today = new Date()) → { accuracy7: number|null, rounds7, roundsByDay: [{ date, count }] (7), topConfusions: [[key, count]] (≤ 5, all-time) }`.

- [ ] **Step 1: Write failing tests**

`tests/unit/stats.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { lastDays, summarize } from '../../js/stats.js';

const today = new Date(2026, 9, 3, 12);
const entry = (date, exercise, correct, confusions = {}) => ({ date, exercise, correct, total: 10, confusions });

test('lastDays lists seven local dates ending today', () => {
  assert.deepEqual(lastDays(today, 7), ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
});

test('no history gives null accuracy and zero rounds', () => {
  const s = summarize([], 'digits', today);
  assert.equal(s.accuracy7, null);
  assert.equal(s.rounds7, 0);
  assert.equal(s.roundsByDay.length, 7);
  assert.deepEqual(s.topConfusions, []);
});

test('accuracy and rounds cover only the last 7 days and the given exercise', () => {
  const h = [
    entry('2026-09-20', 'digits', 0),
    entry('2026-10-01', 'digits', 8),
    entry('2026-10-03', 'digits', 6),
    entry('2026-10-03', 'letters', 0),
  ];
  const s = summarize(h, 'digits', today);
  assert.equal(s.accuracy7, 70);
  assert.equal(s.rounds7, 2);
  assert.equal(s.roundsByDay.find((d) => d.date === '2026-10-03').count, 1);
});

test('top confusions are summed and sorted', () => {
  const h = [
    entry('2026-10-01', 'letters', 5, { 'b>d': 2, 'M>N': 1 }),
    entry('2026-10-02', 'letters', 5, { 'b>d': 1, 'E>F': 2 }),
  ];
  assert.deepEqual(summarize(h, 'letters', today).topConfusions, [['b>d', 3], ['E>F', 2], ['M>N', 1]]);
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`js/stats.js`:
```js
import { localDate } from './util.js';

export function lastDays(today, n) {
  return Array.from({ length: n }, (_, i) => localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1 - i))));
}

export function summarize(history, exerciseId, today = new Date()) {
  const days = lastDays(today, 7);
  const own = history.filter((h) => h.exercise === exerciseId);
  const recent = own.filter((h) => h.date >= days[0] && h.date <= days[6]);
  const correct = recent.reduce((s, h) => s + h.correct, 0);
  const total = recent.reduce((s, h) => s + h.total, 0);
  const conf = {};
  for (const h of own) for (const [k, v] of Object.entries(h.confusions ?? {})) conf[k] = (conf[k] ?? 0) + v;
  return {
    accuracy7: total ? Math.round((correct / total) * 100) : null,
    rounds7: recent.length,
    roundsByDay: days.map((date) => ({ date, count: recent.filter((h) => h.date === date).length })),
    topConfusions: Object.entries(conf).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5),
  };
}
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/unit/stats.test.js
git commit -m "feat: add progress statistics for the parent area"
```

---

### Task 11: Speech and sounds

**Files:**
- Create: `js/speech.js`, `js/sounds.js`
- Test: `tests/unit/speech.test.js`

**Interfaces:**
- Produces:
  - `createSpeech({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) → { speak(text), cancel(), setEnabled(bool), hasGermanVoice() }` – `speak` cancels any running utterance first; silent when disabled, no synth, or no German voice.
  - `createSounds() → { setEnabled(bool), success(), fanfare() }` – Web Audio tones, never throws.

- [ ] **Step 1: Write failing tests**

`tests/unit/speech.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeech } from '../../js/speech.js';

class FakeUtterance { constructor(text) { this.text = text; } }
function fakeSynth(voices = [{ lang: 'de-DE', name: 'Anna' }]) {
  const calls = [];
  return { calls, getVoices: () => voices, cancel: () => calls.push('cancel'), speak: (u) => calls.push(['speak', u.text, u.lang]), addEventListener() {} };
}

test('speak cancels the previous utterance and speaks German', () => {
  const synth = fakeSynth();
  const s = createSpeech({ synth, Utterance: FakeUtterance });
  s.speak('Hallo');
  assert.deepEqual(synth.calls, ['cancel', ['speak', 'Hallo', 'de-DE']]);
});

test('disabled speech stays silent', () => {
  const synth = fakeSynth();
  const s = createSpeech({ synth, Utterance: FakeUtterance });
  s.setEnabled(false);
  synth.calls.length = 0;
  s.speak('Hallo');
  assert.deepEqual(synth.calls, []);
});

test('without a German voice it stays silent and reports it', () => {
  const synth = fakeSynth([{ lang: 'en-US', name: 'Sam' }]);
  const s = createSpeech({ synth, Utterance: FakeUtterance });
  s.speak('Hallo');
  assert.deepEqual(synth.calls, []);
  assert.equal(s.hasGermanVoice(), false);
});

test('without speech synthesis nothing throws', () => {
  const s = createSpeech({ synth: undefined, Utterance: undefined });
  s.speak('Hallo');
  s.cancel();
  assert.equal(s.hasGermanVoice(), false);
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`js/speech.js`:
```js
export function createSpeech({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  let enabled = true;
  let voice = null;
  const findVoice = () => {
    if (!synth) return null;
    voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('de')) ?? null;
    return voice;
  };
  if (synth) {
    findVoice();
    synth.addEventListener?.('voiceschanged', findVoice);
  }
  return {
    setEnabled(v) {
      enabled = v;
      if (!v) synth?.cancel();
    },
    hasGermanVoice: () => !!(voice ?? findVoice()),
    speak(text) {
      if (!enabled || !synth || !Utterance || !(voice ?? findVoice())) return;
      synth.cancel();
      const u = new Utterance(text);
      u.voice = voice;
      u.lang = 'de-DE';
      u.rate = 0.9;
      synth.speak(u);
    },
    cancel() { synth?.cancel(); },
  };
}
```

`js/sounds.js`:
```js
export function createSounds() {
  let enabled = true;
  let ac = null;
  function play(notes) {
    if (!enabled) return;
    try {
      ac ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime;
      for (const [freq, start, dur] of notes) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(t0 + start);
        osc.stop(t0 + start + dur + 0.05);
      }
    } catch {
      // no audio available
    }
  }
  return {
    setEnabled(v) { enabled = v; },
    success: () => play([[660, 0, 0.12], [880, 0.1, 0.2]]),
    fanfare: () => play([[523, 0, 0.15], [659, 0.15, 0.15], [784, 0.3, 0.15], [1047, 0.45, 0.45]]),
  };
}
```

- [ ] **Step 4: Run – expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/speech.js js/sounds.js tests/unit/speech.test.js
git commit -m "feat: add speech output and sound effects"
```

---

### Task 12: Graphics and font assets

**Files:**
- Create: `assets/fonts/andika-latin-400-normal.woff2`, `assets/fonts/andika-latin-700-normal.woff2`, `assets/fonts/OFL.txt`
- Create: `assets/objects/{apple,ball,star,fish,flower,car}.svg`
- Create: `assets/avatars/{fox,bear,cat,owl,rabbit,frog}.svg`
- Create: `assets/ui/{gear,back,album,again,check,lock,star}.svg`
- Create: `assets/icons/icon.svg`
- Create: `assets/stickers/<page>/<name>.svg` for all 40 stickers in `PAGES` (Task 8)
- Create: `tools/asset-sheet.html`
- Test: `tests/unit/assets.test.js`

**Interfaces:**
- Consumes: `PAGES`, `stickerId`, `stickerUrl` (rewards), `OBJECTS` (quantity), `AVATARS` (profiles).
- Produces: files at the paths above; UI icon names used later: `gear`, `back`, `album`, `again`, `check`, `lock`, `star`.

**SVG style rules (all files):**
- Root exactly `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`, no `width`/`height`.
- Only `path`, `circle`, `ellipse`, `rect`, `polygon`, `polyline`, `line`, `g`. No `text`, `image`, `script`, `filter`, gradients, external references.
- Flat colors, 2–5 fills per file. Outline `stroke="#1F2A44" stroke-width="3" stroke-linejoin="round"` on avatars, stickers, objects. UI icons: single color `#1F2A44` (star icon: `#FFC233` with outline).
- Motif centered, filling ~80 % of the box; instantly recognizable at 48 px. Objects must look identical in shape across instances (they are counted).
- Each file < 6000 bytes.

Palette: `#E5484D` red, `#FF9F1C` orange, `#FFC233` yellow, `#2EAD5B` green, `#2B59C3` blue, `#7C5CFF` violet, `#8B5E3C` brown, `#9AA3B5` grey, `#FFFFFF` white, `#1F2A44` outline.

- [ ] **Step 1: Write the failing asset test**

`tests/unit/assets.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { PAGES, stickerId, stickerUrl } from '../../js/rewards.js';
import { OBJECTS } from '../../js/exercises/quantity.js';
import { AVATARS } from '../../js/profiles.js';

const UI = ['gear', 'back', 'album', 'again', 'check', 'lock', 'star'];
const file = (p) => new URL(`../../${p}`, import.meta.url);

function checkSvg(path) {
  assert.ok(existsSync(file(path)), `${path} fehlt`);
  const s = readFileSync(file(path), 'utf8').trim();
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100">/, `${path}: Root-Element`);
  assert.match(s, /<\/svg>$/, `${path}: Ende`);
  assert.doesNotMatch(s, /<(text|image|script|filter|linearGradient|radialGradient)\b/, `${path}: verbotenes Element`);
  assert.doesNotMatch(s, /<svg[^>]*\s(width|height)=/, `${path}: width/height`);
  assert.ok(s.length < 6000, `${path}: zu groß (${s.length})`);
}

test('quantity objects exist', () => { for (const o of OBJECTS) checkSvg(`assets/objects/${o}.svg`); });
test('avatars exist', () => { for (const a of AVATARS) checkSvg(`assets/avatars/${a}.svg`); });
test('ui icons exist', () => { for (const u of UI) checkSvg(`assets/ui/${u}.svg`); });
test('app icon exists', () => checkSvg('assets/icons/icon.svg'));
test('all 40 stickers exist', () => {
  for (const p of PAGES) for (const s of p.stickers) checkSvg(stickerUrl(stickerId(p.id, s)));
});
test('Andika fonts and license are bundled', () => {
  for (const f of ['andika-latin-400-normal.woff2', 'andika-latin-700-normal.woff2', 'OFL.txt']) {
    assert.ok(existsSync(file(`assets/fonts/${f}`)), f);
    assert.ok(statSync(file(`assets/fonts/${f}`)).size > 1000, `${f} leer`);
  }
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, `assets/objects/apple.svg fehlt`.

- [ ] **Step 3: Download the Andika font (SIL OFL)**

Andika is designed for early readers (single-story „a“, clear l/I distinction).
```bash
mkdir -p assets/fonts
curl -fL -o assets/fonts/andika-latin-400-normal.woff2 https://cdn.jsdelivr.net/npm/@fontsource/andika@5/files/andika-latin-400-normal.woff2
curl -fL -o assets/fonts/andika-latin-700-normal.woff2 https://cdn.jsdelivr.net/npm/@fontsource/andika@5/files/andika-latin-700-normal.woff2
curl -fL -o assets/fonts/OFL.txt https://raw.githubusercontent.com/google/fonts/main/ofl/andika/OFL.txt
```
Expected: three files, each > 1 KB. If a URL returns 404, run `npm view @fontsource/andika version` and list files via `https://cdn.jsdelivr.net/npm/@fontsource/andika@<version>/files/` to find the latin 400/700 woff2 names; keep the target filenames above.

- [ ] **Step 4: Create the reference SVGs exactly as given**

`assets/objects/apple.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 30c-8-8-30-8-34 12-4 22 12 46 26 46 4 0 6-2 8-2s4 2 8 2c14 0 30-24 26-46-4-20-26-20-34-12z" fill="#E5484D" stroke="#1F2A44" stroke-width="3" stroke-linejoin="round"/><path d="M50 30c0-8 2-14 6-18" fill="none" stroke="#1F2A44" stroke-width="4" stroke-linecap="round"/><path d="M56 20c6-8 16-8 20-4-4 6-12 8-20 4z" fill="#2EAD5B" stroke="#1F2A44" stroke-width="3" stroke-linejoin="round"/></svg>
```

`assets/ui/star.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,6 63,36 95,38 70,59 78,92 50,74 22,92 30,59 5,38 37,36" fill="#FFC233" stroke="#1F2A44" stroke-width="4" stroke-linejoin="round"/></svg>
```

`assets/stickers/sea/fish.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M14 50c14-22 44-26 62-8l14-12v40L76 58c-18 18-48 14-62-8z" fill="#FF9F1C" stroke="#1F2A44" stroke-width="3" stroke-linejoin="round"/><path d="M44 36c4 8 4 20 0 28" fill="none" stroke="#1F2A44" stroke-width="3" stroke-linecap="round"/><circle cx="28" cy="46" r="5" fill="#FFFFFF" stroke="#1F2A44" stroke-width="3"/><circle cx="29" cy="46" r="2" fill="#1F2A44"/></svg>
```

`assets/icons/icon.svg` (app icon: lightning-bolt eye on blue rounded square):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" rx="22" fill="#2B59C3"/><ellipse cx="50" cy="52" rx="38" ry="24" fill="#FFFFFF" stroke="#1F2A44" stroke-width="3"/><circle cx="50" cy="52" r="15" fill="#FF9F1C" stroke="#1F2A44" stroke-width="3"/><polygon points="54,30 40,56 50,56 46,74 62,46 52,46" fill="#FFC233" stroke="#1F2A44" stroke-width="2.5" stroke-linejoin="round"/></svg>
```

- [ ] **Step 5: Draw the remaining SVGs following the style rules**

Create every remaining file listed under **Files** (5 objects, 6 avatars as friendly animal faces, 6 UI icons, 39 stickers). Motifs:
- objects: `ball` (red/white beach ball), `star` (yellow five-point star, same shape as ui/star), `fish` (blue simple fish, side view), `flower` (5 round petals, yellow centre), `car` (red car side view, two wheels).
- ui: `gear` (cog), `back` (left arrow), `album` (closed book with star), `again` (circular arrow), `check` (tick), `lock` (padlock).
- stickers: one clear motif per name in `PAGES` (e.g. `dinos/footprint` = three-toed footprint, `space/ufo` = saucer with dome).

- [ ] **Step 6: Create the asset contact sheet and check it visually**

`tools/asset-sheet.html`:
```html
<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>Asset-Übersicht</title>
<style>
  body { font-family: system-ui, sans-serif; background: #FFF7E8; margin: 16px; }
  section { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  figure { margin: 0; text-align: center; font-size: 11px; }
  img { width: 72px; height: 72px; background: #fff; border-radius: 12px; display: block; }
  img.small { width: 32px; height: 32px; }
</style></head>
<body>
<h1>Assets</h1>
<div id="out"></div>
<script type="module">
  import { PAGES, stickerId, stickerUrl } from '../js/rewards.js';
  import { OBJECTS } from '../js/exercises/quantity.js';
  import { AVATARS } from '../js/profiles.js';
  const groups = {
    Objekte: OBJECTS.map((o) => `../assets/objects/${o}.svg`),
    Avatare: AVATARS.map((a) => `../assets/avatars/${a}.svg`),
    UI: ['gear', 'back', 'album', 'again', 'check', 'lock', 'star'].map((u) => `../assets/ui/${u}.svg`),
    Icon: ['../assets/icons/icon.svg'],
    ...Object.fromEntries(PAGES.map((p) => [p.title, p.stickers.map((s) => `../${stickerUrl(stickerId(p.id, s))}`)])),
  };
  const out = document.getElementById('out');
  for (const [title, srcs] of Object.entries(groups)) {
    out.insertAdjacentHTML('beforeend', `<h2>${title}</h2>`);
    const sec = document.createElement('section');
    for (const src of srcs) sec.insertAdjacentHTML('beforeend', `<figure><img src="${src}"><img class="small" src="${src}"><figcaption>${src.split('/').pop()}</figcaption></figure>`);
    out.append(sec);
  }
</script>
</body>
</html>
```

Run in a second terminal: `npm run serve`. Then take a screenshot:
```bash
npx playwright screenshot --full-page http://localhost:4173/tools/asset-sheet.html _lokal/asset-sheet.png
```
Open `_lokal/asset-sheet.png` (Read tool) and confirm: every motif recognizable at 32 px, no broken images, consistent outline style. Redraw any failing file.

- [ ] **Step 7: Run tests – expect pass**

Run: `npm test`
Expected: PASS (all asset tests).

- [ ] **Step 8: Commit**

```bash
git add assets tools/asset-sheet.html tests/unit/assets.test.js
git commit -m "feat: add svg graphics, stickers and Andika font"
```

---

### Task 13: App shell, styles, profile selection and menu

**Files:**
- Create: `index.html`, `css/app.css`, `js/app.js`, `js/ui/widgets.js`, `js/ui/gate.js`, `js/ui/profiles.js`, `js/ui/menu.js`
- Create (stubs, replaced in Tasks 14–16): `js/ui/round.js`, `js/ui/album.js`, `js/ui/parents.js`
- Test: `tests/e2e/helpers.js`, `tests/e2e/start.spec.js`

**Interfaces:**
- Consumes: `createStore`, `createSpeech`, `createSounds`, profile functions, `EXERCISES`, `EXERCISE_ORDER`, `h`.
- Produces:
  - Screen module contract: `export function render(root, ctx, params) → cleanup | undefined`.
  - `ctx = { store, speech, sounds, state (getter), profile (getter), setState(nextState), go(screenName, params) }`; screens: `profiles`, `menu`, `round` (`{ exerciseId }`), `album` (`{ highlight }`), `parents`.
  - widgets: `uiIcon(name)`, `iconBtn(name, label, onClick, testid)`, `starBadge(stars)`, `avatarImg(avatar)`.
  - gate: `attachLongPress(el, ms, onDone)`, `makeChallenge(rng = Math.random) → { a, b, answer }`.
  - test ids: `profile-name`, `avatar-<name>`, `create-profile`, `profile-<id>`, `tile-<exerciseId>`, `open-album`, `gear`, `switch-profile`, `star-badge`.
  - e2e helpers: `buildState(mutate)`, `seed(page, mutate)`, `longPress(page, locator, ms)`, `openParents(page)`, `readState(page)`.

- [ ] **Step 1: Write e2e helpers and the failing start test**

`tests/e2e/helpers.js`:
```js
import { expect } from '@playwright/test';
import { createProfile } from '../../js/profiles.js';

export function buildState(mutate = () => {}, name = 'Mia') {
  const p = createProfile({ name, avatar: 'fox' }, { id: 'p1' });
  p.settings.speech = false;
  p.settings.sounds = false;
  mutate(p);
  return { schemaVersion: 1, activeProfileId: 'p1', profiles: [p] };
}

export async function seed(page, mutate) {
  const state = buildState(mutate);
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('blitzblick.v1', JSON.stringify(s));
      sessionStorage.setItem('seeded', '1');
    }
  }, state);
  return state;
}

export async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('blitzblick.v1')));
}

export async function longPress(page, locator, ms = 3300) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

export async function openParents(page) {
  await longPress(page, page.getByTestId('gear'));
  const answer = await page.getByTestId('gate-question').getAttribute('data-answer');
  await page.getByTestId('gate-answer').fill(answer);
  await page.getByTestId('gate-submit').click();
  await expect(page.getByTestId('parents')).toBeVisible();
}
```

`tests/e2e/start.spec.js`:
```js
import { test, expect } from '@playwright/test';
import { seed, readState } from './helpers.js';

test('first start asks for a profile and then shows the menu', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-profile').click();
  await expect(page.locator('.form-msg')).toHaveText(/Namen/);
  await page.locator('#profile-name').fill('Mia');
  await page.getByTestId('avatar-owl').click();
  await page.getByTestId('create-profile').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  await expect(page.getByTestId('tile-digits')).toBeVisible();
  await expect(page.getByTestId('tile-letters')).toBeVisible();
  const state = await readState(page);
  expect(state.profiles[0].name).toBe('Mia');
  expect(state.profiles[0].avatar).toBe('owl');
  await page.reload();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
});

test('letters tile is hidden with fewer than two known letters', async ({ page }) => {
  await seed(page, (p) => { p.settings.letters.known = ['A']; });
  await page.goto('/');
  await expect(page.getByTestId('tile-digits')).toBeVisible();
  await expect(page.getByTestId('tile-letters')).toHaveCount(0);
});

test('with two profiles the picker is shown and switches the active profile', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    const base = (id, name) => ({ id, name, avatar: 'fox', createdAt: '2026-10-03T00:00:00.000Z', settings: {}, levels: {}, rewards: { stars: 0, stickers: [], unlockedPages: 1 }, history: [] });
    localStorage.setItem('blitzblick.v1', JSON.stringify({ schemaVersion: 1, activeProfileId: 'a', profiles: [base('a', 'Mia'), base('b', 'Ben')] }));
    sessionStorage.setItem('seeded', '1');
  });
  await page.goto('/');
  await page.getByTestId('profile-b').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  expect((await readState(page)).activeProfileId).toBe('b');
  await page.getByTestId('switch-profile').click();
  await expect(page.getByTestId('profile-a')).toBeVisible();
});

test('star badge shows the profile stars', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stars = 42; });
  await page.goto('/');
  await expect(page.getByTestId('star-badge')).toHaveText('42');
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npx playwright test tests/e2e/start.spec.js --project=desktop`
Expected: FAIL (404 / no `#app`).

- [ ] **Step 3: Create `index.html`**

```html
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>Blitzblick</title>
<meta name="description" content="Blitzlesen und Blitzrechnen für Erstklässler">
<meta name="theme-color" content="#2B59C3">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="assets/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<link rel="preload" href="assets/fonts/andika-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/app.css">
<script type="module" src="js/app.js"></script>
</head>
<body><div id="app"></div></body>
</html>
```

- [ ] **Step 4: Create `css/app.css` (complete, covers all screens)**

```css
@font-face { font-family: 'Andika'; src: url('../assets/fonts/andika-latin-400-normal.woff2') format('woff2'); font-weight: 400; font-display: block; }
@font-face { font-family: 'Andika'; src: url('../assets/fonts/andika-latin-700-normal.woff2') format('woff2'); font-weight: 700; font-display: block; }

:root {
  --bg: #FFF7E8; --surface: #FFFFFF; --ink: #1F2A44; --muted: #6B7390; --line: #E9E2D3;
  --primary: #2B59C3; --primary-ink: #FFFFFF; --accent: #FF9F1C; --right: #2EAD5B; --wrong: #E5484D; --star: #FFC233;
  --tile-quantity: #FFE1D6; --tile-digits: #DDEBFF; --tile-letters: #E4F6DD;
  --radius: 20px; --shadow: 0 4px 0 rgba(31, 42, 68, .15);
  --font: 'Andika', ui-rounded, 'Segoe UI', system-ui, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--bg); color: var(--ink); font-family: var(--font); font-size: 18px;
  -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none;
  user-select: none; -webkit-user-select: none; touch-action: manipulation; overscroll-behavior: none;
}
#app {
  height: 100dvh; display: flex; flex-direction: column; overflow: hidden;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
#app[data-screen="parents"] { overflow-y: auto; user-select: text; -webkit-user-select: text; }
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
img { -webkit-user-drag: none; }
h1, h2, h3 { margin: 0 0 .5em; line-height: 1.2; }

/* top bar + shared widgets */
.topbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; min-height: 72px; }
.spacer, .topbar-pad { flex: 1; }
.topbar-pad { flex: 0 0 56px; }
.icon-btn { width: 56px; height: 56px; flex: 0 0 56px; border-radius: 50%; background: var(--surface); box-shadow: var(--shadow); display: grid; place-items: center; position: relative; }
.icon-btn img { width: 32px; height: 32px; }
.icon-btn .avatar { width: 46px; height: 46px; }
.star-badge { display: flex; align-items: center; gap: 6px; font-size: 1.5rem; font-weight: 700; background: var(--surface); padding: 6px 16px 6px 10px; border-radius: 999px; box-shadow: var(--shadow); }
.star-badge img { width: 30px; height: 30px; }
.gear::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; border: 5px solid var(--accent); clip-path: inset(0 100% 0 0); }
.gear.pressing::after { animation: ring 3s linear forwards; }
@keyframes ring { to { clip-path: inset(0 0 0 0); } }
@keyframes pop { 0% { transform: scale(.6); opacity: 0; } 70% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
@keyframes wiggle { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }

/* forms (first start, gate, parents) */
.center { flex: 1; display: grid; place-items: center; padding: 16px; }
.card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; width: 100%; max-width: 520px; }
.welcome p, .gate p { color: var(--muted); }
label, .label { display: block; font-weight: 700; margin: 12px 0 6px; }
input[type="text"], input[type="number"], select {
  font: inherit; width: 100%; padding: 10px 12px; border: 2px solid var(--line); border-radius: 12px; background: #fff; color: var(--ink);
}
input:focus-visible, select:focus-visible, button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.primary-btn, .secondary-btn, .danger-btn { min-height: 48px; padding: 10px 18px; border-radius: 14px; font-weight: 700; box-shadow: var(--shadow); }
.primary-btn { background: var(--primary); color: var(--primary-ink); }
.secondary-btn { background: #fff; border: 2px solid var(--line); }
.danger-btn { background: #fff; color: var(--wrong); border: 2px solid var(--wrong); }
.row { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
.form-msg { min-height: 1.4em; color: var(--muted); }
.form-msg.error { color: var(--wrong); }
.avatar-pick { display: flex; flex-wrap: wrap; gap: 10px; }
.avatar-opt { width: 64px; height: 64px; border-radius: 50%; background: var(--bg); border: 3px solid transparent; display: grid; place-items: center; }
.avatar-opt img { width: 52px; height: 52px; }
.avatar-opt.selected { border-color: var(--primary); background: #fff; }
.avatar-pick.small .avatar-opt { width: 52px; height: 52px; }
.avatar-pick.small .avatar-opt img { width: 40px; height: 40px; }
.welcome .primary-btn { width: 100%; margin-top: 8px; }

/* profile picker */
.profile-picker { flex: 1; display: flex; flex-wrap: wrap; gap: 20px; align-content: center; justify-content: center; padding: 16px; }
.profile-card { width: 160px; padding: 16px; border-radius: 28px; background: var(--surface); box-shadow: var(--shadow); display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 1.4rem; font-weight: 700; }
.profile-card .avatar { width: 110px; height: 110px; }

/* menu */
.menu { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px; padding: 16px; align-content: center; max-width: 960px; width: 100%; margin: 0 auto; }
.tile { aspect-ratio: 1.3; border-radius: 28px; box-shadow: var(--shadow); font-size: clamp(2.5rem, 9vw, 4.5rem); font-weight: 700; display: grid; place-items: center; transition: transform .1s; }
.tile:active { transform: translateY(3px); box-shadow: none; }
.tile-quantity { background: var(--tile-quantity); }
.tile-digits { background: var(--tile-digits); }
.tile-letters { background: var(--tile-letters); }
.tile-apples { display: flex; gap: 6%; width: 80%; justify-content: center; }
.tile-apples img { width: 30%; }
.menu-foot { display: flex; justify-content: center; padding: 8px 16px 20px; }
.album-btn { display: flex; align-items: center; gap: 10px; background: var(--surface); box-shadow: var(--shadow); border-radius: 999px; padding: 10px 22px 10px 14px; font-size: 1.6rem; font-weight: 700; }
.album-btn img { width: 48px; height: 48px; }

/* round */
.round-stars { flex: 1; display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; }
.round-stars .slot { width: 20px; height: 20px; border-radius: 50%; background: var(--line); transition: background .3s, transform .3s; }
.round-stars .slot.earned { background: var(--star); transform: scale(1.25); }
.round-stars .slot.missed { background: #CFC8B8; }
.stage { flex: 1; min-height: 0; display: grid; place-items: center; padding: 8px; container-type: size; position: relative; }
.stage .fixation { width: 18px; height: 18px; border-radius: 50%; background: var(--ink); }
.stage .mask { width: min(100cqw, 100cqh); height: min(100cqw, 100cqh); border-radius: var(--radius); background: repeating-linear-gradient(45deg, #EDE6D6 0 12px, #F6F0E2 12px 24px); }
.stimulus { width: 100%; height: 100%; display: grid; place-items: center; }
.stimulus.preload { visibility: hidden; position: absolute; inset: 8px; width: auto; height: auto; }
.stimulus.solution { animation: pop .3s; }
.field { position: relative; width: min(100cqw, 100cqh); height: min(100cqw, 100cqh); background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); }
.obj { position: absolute; width: 14%; height: 14%; transform: translate(-50%, -50%); }
.flash-text { font-size: min(60cqh, 50cqw); font-weight: 700; line-height: 1; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 0 .25em; min-width: 1.3em; text-align: center; }
.choices-area { padding: 8px 8px 16px; min-height: 96px; }
.choices { display: grid; gap: 6px; max-width: 760px; margin: 0 auto; }
.choices.cols-2 { grid-template-columns: repeat(2, minmax(64px, 180px)); justify-content: center; }
.choices.cols-3 { grid-template-columns: repeat(3, minmax(64px, 180px)); justify-content: center; }
.choices.cols-4 { grid-template-columns: repeat(4, minmax(64px, 180px)); justify-content: center; }
.choices.cols-5 { grid-template-columns: repeat(5, minmax(64px, 1fr)); }
.choice { min-height: 72px; min-width: 64px; border-radius: 18px; background: var(--surface); box-shadow: var(--shadow); font-size: 2rem; font-weight: 700; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 4px; transition: transform .1s; animation: pop .25s; }
.choice:active { transform: translateY(3px); box-shadow: none; }
.choice .dots { display: flex; flex-direction: column; font-size: .65rem; line-height: .8; color: var(--muted); letter-spacing: 1px; }
.choice .glyph { font-size: 2.6rem; line-height: 1; }
.choice:disabled { opacity: .45; cursor: default; }
.choice.right { background: var(--right); color: #fff; opacity: 1; }
.choice.right .dots { color: #fff; }
.choice.wrong { background: var(--wrong); color: #fff; opacity: 1; animation: wiggle .3s; }

/* round end */
.round-end { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 16px; text-align: center; }
.big-stars { display: flex; align-items: center; gap: 10px; font-size: 3rem; font-weight: 700; animation: pop .4s; }
.big-stars img { width: 64px; height: 64px; }
.sticker-reveal { width: min(60vw, 40vh); aspect-ratio: 1; background: var(--surface); border-radius: 32px; box-shadow: var(--shadow); display: grid; place-items: center; animation: pop .6s .2s both; }
.sticker-reveal img { width: 80%; height: 80%; }
.bonus { font-size: 2.5rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.bonus img { width: 56px; }
.unlock { display: flex; align-items: center; gap: 8px; font-size: 2rem; animation: pop .5s .6s both; }
.unlock img { width: 56px; }
.end-actions { display: flex; gap: 16px; }
.big-btn { width: 88px; height: 88px; border-radius: 50%; background: var(--surface); box-shadow: var(--shadow); display: grid; place-items: center; }
.big-btn img { width: 48px; height: 48px; }
.big-btn.go { background: var(--right); }

/* album */
.album-tabs { display: flex; gap: 8px; justify-content: center; padding: 0 12px 8px; flex-wrap: wrap; }
.album-tab { width: 64px; height: 64px; border-radius: 18px; background: var(--surface); box-shadow: var(--shadow); display: grid; place-items: center; border: 3px solid transparent; }
.album-tab img { width: 44px; height: 44px; }
.album-tab.active { border-color: var(--primary); }
.album-tab.locked img { opacity: .6; }
.album-page { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 16px 16px; }
.sticker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(40vw, 140px), 1fr)); gap: 12px; max-width: 760px; margin: 0 auto; }
.sticker { aspect-ratio: 1; border-radius: 22px; background: var(--surface); box-shadow: var(--shadow); display: grid; place-items: center; }
.sticker img { width: 78%; height: 78%; filter: brightness(0); opacity: .12; }
.sticker.collected img { filter: none; opacity: 1; }
.sticker.highlight { animation: pop .6s; outline: 4px solid var(--star); }
.locked-page { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
.locked-page > img { width: 120px; opacity: .7; }
.locked-page .need { display: flex; align-items: center; gap: 8px; font-size: 2.5rem; font-weight: 700; }
.locked-page .need img { width: 52px; }

/* parents */
.parents { width: 100%; max-width: 860px; margin: 0 auto; padding: 16px; }
.parents-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.parents-head h1 { margin: 0; }
.warnings { background: #FFF1D6; border: 2px solid var(--accent); border-radius: 14px; padding: 8px 14px; margin-bottom: 12px; }
.warnings p { margin: 6px 0; }
.tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.tab { padding: 10px 16px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow); font-weight: 700; }
.tab.active { background: var(--primary); color: var(--primary-ink); }
.panel-body fieldset { border: 0; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 14px 18px 18px; margin: 0 0 16px; }
.panel-body legend { font-weight: 700; font-size: 1.15rem; padding: 0; float: left; width: 100%; margin-bottom: 8px; }
.check { display: flex; align-items: center; gap: 10px; font-weight: 400; margin: 8px 0; }
.check input { width: 22px; height: 22px; }
.field-row { display: grid; grid-template-columns: 140px 1fr auto; align-items: center; gap: 10px; font-weight: 400; }
.field-row .unit { color: var(--muted); }
.hint { color: var(--muted); margin: 4px 0 8px; clear: both; }
.letter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 6px; margin: 8px 0 12px; }
.letter { position: relative; height: 48px; border-radius: 12px; border: 2px solid var(--line); display: grid; place-items: center; font-size: 1.4rem; font-weight: 700; margin: 0; background: #fff; }
.letter input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; margin: 0; cursor: pointer; }
.letter.on { background: var(--right); border-color: var(--right); color: #fff; }
.stat { margin-bottom: 12px; max-width: none; }
.stat p { margin: 4px 0; }
.bars { display: flex; gap: 8px; align-items: flex-end; height: 70px; margin: 8px 0; }
.bar { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px; }
.bar span { width: 100%; background: var(--primary); border-radius: 6px 6px 0 0; min-height: 2px; }
.bar small { color: var(--muted); font-size: .7rem; }
.profile-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; max-width: none; }
.profile-row .avatar { width: 48px; height: 48px; }
.profile-row input[type="text"] { flex: 1; min-width: 140px; width: auto; }
.profile-row select { width: auto; }
.badge { background: var(--tile-letters); padding: 6px 12px; border-radius: 999px; font-weight: 700; }
@media (max-width: 480px) { .field-row { grid-template-columns: 1fr auto; } .field-row > span:first-child { grid-column: 1 / -1; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
```

- [ ] **Step 5: Create widgets, gate helpers, screens and app**

`js/ui/widgets.js`:
```js
import { h } from './dom.js';

export const uiIcon = (name) => h('img', { src: `assets/ui/${name}.svg`, alt: '' });

export function iconBtn(name, label, onClick, testid) {
  return h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, 'data-testid': testid, onClick }, uiIcon(name));
}

export function starBadge(stars) {
  return h('div', { class: 'star-badge', 'data-testid': 'star-badge' }, uiIcon('star'), String(stars));
}

export function avatarImg(avatar) {
  return h('img', { class: 'avatar', src: `assets/avatars/${avatar}.svg`, alt: '' });
}
```

`js/ui/gate.js`:
```js
import { randInt } from '../rng.js';

export function attachLongPress(el, ms, onDone) {
  let timer = null;
  const stop = () => {
    clearTimeout(timer);
    timer = null;
    el.classList.remove('pressing');
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stop();
    el.classList.add('pressing');
    timer = setTimeout(() => { stop(); onDone(); }, ms);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(type, stop);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function makeChallenge(rng = Math.random) {
  const a = randInt(rng, 3, 9);
  const b = randInt(rng, 3, 9);
  return { a, b, answer: a * b };
}
```

`js/ui/profiles.js`:
```js
import { h } from './dom.js';
import { avatarImg } from './widgets.js';
import { AVATARS, createProfile, addProfile, setActive } from '../profiles.js';

function renderCreate(root, ctx) {
  let avatar = AVATARS[0];
  const name = h('input', { id: 'profile-name', type: 'text', maxlength: '20', autocomplete: 'off', placeholder: 'Name des Kindes' });
  const pick = h('div', { class: 'avatar-pick' }, AVATARS.map((a) => h('button', {
    type: 'button',
    class: `avatar-opt${a === avatar ? ' selected' : ''}`,
    'data-testid': `avatar-${a}`,
    'aria-label': a,
    onClick: (e) => {
      avatar = a;
      [...pick.children].forEach((b) => b.classList.toggle('selected', b === e.currentTarget));
    },
  }, avatarImg(a))));
  const msg = h('p', { class: 'form-msg' });
  const form = h('form', {
    class: 'card welcome',
    onSubmit: (e) => {
      e.preventDefault();
      if (!name.value.trim()) { msg.textContent = 'Bitte einen Namen eingeben.'; return; }
      ctx.setState(addProfile(ctx.state, createProfile({ name: name.value, avatar })));
      ctx.go('menu');
    },
  },
  h('h1', {}, 'Willkommen bei Blitzblick'),
  h('p', {}, 'Lege ein Profil für dein Kind an. Weitere Einstellungen findest du später im Elternbereich: Zahnrad oben rechts 3 Sekunden gedrückt halten.'),
  h('label', { for: 'profile-name' }, 'Name'), name,
  h('div', { class: 'label' }, 'Bild'), pick,
  msg,
  h('button', { class: 'primary-btn', type: 'submit', 'data-testid': 'create-profile' }, 'Profil anlegen'));
  root.append(h('main', { class: 'center' }, form));
}

export function render(root, ctx) {
  const { profiles } = ctx.state;
  if (!profiles.length) return renderCreate(root, ctx);
  root.append(h('main', { class: 'profile-picker' }, profiles.map((p) => h('button', {
    class: 'profile-card',
    'data-testid': `profile-${p.id}`,
    onClick: () => { ctx.setState(setActive(ctx.state, p.id)); ctx.go('menu'); },
  }, avatarImg(p.avatar), h('span', {}, p.name)))));
  ctx.speech.speak('Wer bist du?');
}
```

`js/ui/menu.js`:
```js
import { h } from './dom.js';
import { EXERCISES, EXERCISE_ORDER } from '../exercises/index.js';
import { iconBtn, starBadge, avatarImg, uiIcon } from './widgets.js';
import { attachLongPress } from './gate.js';

const TILE_CONTENT = {
  quantity: () => h('span', { class: 'tile-apples' }, [0, 1, 2].map(() => h('img', { src: 'assets/objects/apple.svg', alt: '' }))),
  digits: () => '1 2 3',
  letters: () => 'A B C',
};

export function render(root, ctx) {
  const p = ctx.profile;
  const ids = EXERCISE_ORDER.filter((id) => p.settings.exercises[id] && EXERCISES[id].isAvailable(p.settings));
  const gear = iconBtn('gear', 'Elternbereich: 3 Sekunden gedrückt halten', null, 'gear');
  gear.classList.add('gear');
  attachLongPress(gear, 3000, () => ctx.go('parents'));
  const who = ctx.state.profiles.length > 1
    ? h('button', { class: 'icon-btn', 'data-testid': 'switch-profile', 'aria-label': 'Profil wechseln', onClick: () => ctx.go('profiles') }, avatarImg(p.avatar))
    : h('div', { class: 'icon-btn' }, avatarImg(p.avatar));
  root.append(
    h('header', { class: 'topbar' }, who, h('div', { class: 'spacer' }), starBadge(p.rewards.stars), gear),
    h('main', { class: 'menu' }, ids.map((id) => h('button', {
      class: `tile tile-${id}`,
      'data-testid': `tile-${id}`,
      'aria-label': EXERCISES[id].title,
      onClick: () => ctx.go('round', { exerciseId: id }),
    }, TILE_CONTENT[id]()))),
    h('footer', { class: 'menu-foot' }, h('button', {
      class: 'album-btn', 'data-testid': 'open-album', 'aria-label': 'Sammelalbum', onClick: () => ctx.go('album'),
    }, uiIcon('album'), h('span', {}, String(p.rewards.stickers.length)))),
  );
  ctx.speech.speak(`Hallo ${p.name}! Was möchtest du üben?`);
}
```

Stubs (replaced later) – `js/ui/round.js`, `js/ui/album.js`, `js/ui/parents.js`, each:
```js
export function render(root, ctx) {
  ctx.go('menu');
}
```

`js/app.js`:
```js
import { createStore } from './storage.js';
import { createSpeech } from './speech.js';
import { createSounds } from './sounds.js';
import { getActive } from './profiles.js';
import * as profiles from './ui/profiles.js';
import * as menu from './ui/menu.js';
import * as round from './ui/round.js';
import * as album from './ui/album.js';
import * as parents from './ui/parents.js';

const SCREENS = { profiles, menu, round, album, parents };
const root = document.getElementById('app');
const store = createStore();
const speech = createSpeech();
const sounds = createSounds();
let state = store.load();
let cleanup = null;

function applyProfilePrefs() {
  const p = getActive(state);
  speech.setEnabled(p?.settings.speech ?? true);
  sounds.setEnabled(p?.settings.sounds ?? true);
}

const ctx = {
  store,
  speech,
  sounds,
  get state() { return state; },
  get profile() { return getActive(state); },
  setState(next) {
    state = next;
    store.save(state);
    applyProfilePrefs();
  },
  go(name, params = {}) {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    speech.cancel();
    root.replaceChildren();
    const target = (name === 'menu' || name === 'round' || name === 'album') && !getActive(state) ? 'profiles' : name;
    root.dataset.screen = target;
    cleanup = SCREENS[target].render(root, ctx, params) ?? null;
  },
};

applyProfilePrefs();
ctx.go(getActive(state) && state.profiles.length === 1 ? 'menu' : 'profiles');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
```

- [ ] **Step 6: Run e2e – expect pass**

Run: `npx playwright test tests/e2e/start.spec.js`
Expected: 8 passed (4 tests × 2 projects). `sw.js` 404 is caught silently until Task 17.

- [ ] **Step 7: Check the look**

Run (server from `npm run serve` or Playwright): `npx playwright screenshot --viewport-size=1024,768 http://localhost:4173/ _lokal/start.png` and Read the image. The welcome card should be centred, Andika font, no layout overflow.

- [ ] **Step 8: Commit**

```bash
git add index.html css js/app.js js/ui tests/e2e
git commit -m "feat: add app shell, profile selection and menu"
```

---

### Task 14: Round screen and round end

**Files:**
- Modify: `js/ui/round.js` (replace stub)
- Create: `js/ui/round-end.js`
- Test: `tests/e2e/round.spec.js`

**Interfaces:**
- Consumes: `createRound`, `nextTask`, `answerTask`, `finishRound`, `abortRound`, `ROUND_LENGTH`, `updateProfile`, `EXERCISES`, `stickerUrl`, widgets.
- Produces:
  - Constants `FIXATION_MS = 800`, `MASK_MS = 200`, `FEEDBACK_MS = 1000`, `SOLUTION_MS = 2500`.
  - test ids: `back`, `round-stars` (children `.slot` with `.earned` / `.missed`), `stage`, `stimulus` (only the visible flash), `choices` (with `data-answer` while answers are shown), `round-end`, `new-sticker` (`data-sticker`), `bonus-stars`, `page-unlocked`, `play-again`, `round-done`, `to-album`.
  - `renderRoundEnd(root, ctx, { exerciseId, correct, reward })`.

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/round.spec.js`:
```js
import { test, expect } from '@playwright/test';
import { seed, readState } from './helpers.js';

const fixed = (ms, extra = () => {}) => (p) => {
  p.settings.timing = { startMs: ms, minMs: 300, maxMs: 3000, adaptive: false };
  extra(p);
};

async function waitForChoices(page) {
  const choices = page.getByTestId('choices');
  await expect(choices.locator('button.choice').first()).toBeVisible({ timeout: 6000 });
  return { choices, answer: await choices.getAttribute('data-answer') };
}

test('a full quantity round awards stars and a sticker', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  for (let i = 0; i < 10; i++) {
    const { choices, answer } = await waitForChoices(page);
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('new-sticker')).toBeVisible();
  const p = (await readState(page)).profiles[0];
  expect(p.rewards.stars).toBe(10);
  expect(p.rewards.stickers).toHaveLength(1);
  expect(p.history).toHaveLength(1);
  await page.getByTestId('round-done').click();
  await expect(page.getByTestId('star-badge')).toHaveText('10');
});

test('the flash disappears after the configured duration', async ({ page }) => {
  await seed(page, fixed(1000));
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  const stim = page.getByTestId('stimulus');
  await expect(stim).toBeVisible();
  const t0 = Date.now();
  await expect(stim).toBeHidden({ timeout: 3000 });
  const dt = Date.now() - t0;
  expect(dt).toBeGreaterThan(700);
  expect(dt).toBeLessThan(1700);
});

test('a wrong answer shows the solution and marks the right button', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  const { choices, answer } = await waitForChoices(page);
  await choices.locator(`button.choice:not([data-value="${answer}"])`).first().click();
  await expect(choices.locator(`button[data-value="${answer}"]`)).toHaveClass(/right/);
  await expect(page.locator('.stimulus.solution')).toBeVisible();
  await expect(page.locator('.round-stars .slot.missed')).toHaveCount(1);
});

test('a double tap on an answer counts once', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  const { choices, answer } = await waitForChoices(page);
  await choices.locator(`button[data-value="${answer}"]`).dblclick({ force: true });
  await expect(page.locator('.round-stars .slot.earned, .round-stars .slot.missed')).toHaveCount(1);
});

test('back aborts the round without rewards but keeps difficulty changes', async ({ page }) => {
  await seed(page, (p) => { p.settings.timing.startMs = 500; p.levels.digits.durationMs = 500; });
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  for (let i = 0; i < 3; i++) {
    const { choices, answer } = await waitForChoices(page);
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await page.getByTestId('back').click();
  await expect(page.getByTestId('tile-digits')).toBeVisible();
  const p = (await readState(page)).profiles[0];
  expect(p.rewards.stars).toBe(0);
  expect(p.history).toHaveLength(0);
  expect(p.levels.digits.durationMs).toBe(400);
});

test('only known letters are asked', async ({ page }) => {
  await seed(page, fixed(500, (p) => { p.settings.letters.known = ['B', 'D']; }));
  await page.goto('/');
  await page.getByTestId('tile-letters').click();
  const { choices } = await waitForChoices(page);
  const values = await choices.locator('button.choice').evaluateAll((bs) => bs.map((b) => b.dataset.value));
  expect(values.sort()).toEqual(['B', 'D']);
});

test('small phone viewport: ten answer buttons fit without scrolling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'viewport test runs once');
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, fixed(500, (p) => { p.settings.quantity = { max: 10, layout: 'mixed' }; }));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const { choices } = await waitForChoices(page);
  const buttons = choices.locator('button.choice');
  await expect(buttons).toHaveCount(10);
  for (const box of await buttons.evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().toJSON()))) {
    expect(box.width).toBeGreaterThanOrEqual(64);
    expect(box.height).toBeGreaterThanOrEqual(64);
    expect(box.right).toBeLessThanOrEqual(360);
    expect(box.bottom).toBeLessThanOrEqual(640);
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});
```

Note on `back` test: start 500 ms, three correct → floor(425/50)·50 = 400.

- [ ] **Step 2: Run – expect failure**

Run: `npx playwright test tests/e2e/round.spec.js --project=desktop`
Expected: FAIL (stub returns to menu, `choices` never appears).

- [ ] **Step 3: Implement**

`js/ui/round.js`:
```js
import { h, wait } from './dom.js';
import { EXERCISES } from '../exercises/index.js';
import { createRound, nextTask, answerTask, finishRound, abortRound, ROUND_LENGTH } from '../session.js';
import { updateProfile } from '../profiles.js';
import { iconBtn } from './widgets.js';
import { renderRoundEnd } from './round-end.js';

export const FIXATION_MS = 800;
export const MASK_MS = 200;
export const FEEDBACK_MS = 1000;
export const SOLUTION_MS = 2500;

export function render(root, ctx, { exerciseId }) {
  const ex = EXERCISES[exerciseId];
  const rng = Math.random;
  const profile = ctx.profile;
  let round = createRound(profile, exerciseId, rng);
  let alive = true;

  const stars = h('div', { class: 'round-stars', 'data-testid': 'round-stars' },
    Array.from({ length: ROUND_LENGTH }, () => h('span', { class: 'slot' })));
  const stage = h('div', { class: 'stage', 'data-testid': 'stage' });
  const choicesEl = h('div', { class: 'choices-area', 'data-testid': 'choices' });

  function abort() {
    alive = false;
    if (round.results.length) ctx.setState(updateProfile(ctx.state, profile.id, (p) => abortRound(p, round)));
    ctx.go('menu');
  }

  root.append(
    h('header', { class: 'topbar' }, iconBtn('back', 'Zurück', abort, 'back'), stars, h('div', { class: 'topbar-pad' })),
    stage,
    choicesEl,
  );

  async function playTask() {
    round = nextTask(round, profile, rng);
    const { task, durationMs } = round;
    choicesEl.replaceChildren();
    delete choicesEl.dataset.answer;
    const stim = h('div', { class: 'stimulus preload', 'data-testid': 'stimulus' });
    ex.renderStimulus(task, stim);
    stage.replaceChildren(h('div', { class: 'fixation' }), stim);
    if (round.results.length === 0) ctx.speech.speak('Pass gut auf!');
    await Promise.all([
      wait(FIXATION_MS),
      document.fonts?.ready,
      ...[...stim.querySelectorAll('img')].map((img) => img.decode().catch(() => {})),
    ]);
    if (!alive) return;
    stim.classList.remove('preload');
    stage.replaceChildren(stim);
    await wait(durationMs);
    if (!alive) return;
    stage.replaceChildren(h('div', { class: 'mask' }));
    await wait(MASK_MS);
    if (!alive) return;
    stage.replaceChildren();
    choicesEl.dataset.answer = String(task.answer);
    ex.renderChoices(task, choicesEl, onPick);
    ctx.speech.speak(ex.speakPrompt(task, profile.settings));
  }

  async function onPick(value, button) {
    const res = answerTask(round, profile, value);
    if (res.ignored) return;
    round = res.round;
    const slot = stars.children[round.results.length - 1];
    if (res.correct) {
      button.classList.add('right');
      slot.classList.add('earned');
      ctx.sounds.success();
      await wait(FEEDBACK_MS);
    } else {
      button.classList.add('wrong');
      choicesEl.querySelector(`[data-value="${CSS.escape(String(round.task.answer))}"]`)?.classList.add('right');
      slot.classList.add('missed');
      const solution = h('div', { class: 'stimulus solution' });
      ex.renderStimulus(round.task, solution);
      stage.replaceChildren(solution);
      ctx.speech.speak(ex.speakSolution(round.task, profile.settings));
      await wait(SOLUTION_MS);
    }
    if (!alive) return;
    if (res.finished) finish();
    else playTask();
  }

  function finish() {
    alive = false;
    const { profile: updated, reward } = finishRound(profile, round, rng);
    ctx.setState(updateProfile(ctx.state, profile.id, () => updated));
    const correct = round.results.filter((r) => r.correct).length;
    renderRoundEnd(root, ctx, { exerciseId, correct, reward });
  }

  playTask();
  return () => { alive = false; };
}
```

`js/ui/round-end.js`:
```js
import { h } from './dom.js';
import { uiIcon } from './widgets.js';
import { stickerUrl } from '../rewards.js';

export function renderRoundEnd(root, ctx, { exerciseId, correct, reward }) {
  const prize = reward.sticker
    ? h('div', { class: 'sticker-reveal', 'data-testid': 'new-sticker', 'data-sticker': reward.sticker },
      h('img', { src: stickerUrl(reward.sticker), alt: '' }))
    : h('div', { class: 'bonus', 'data-testid': 'bonus-stars' }, `+${reward.bonusStars}`, uiIcon('star'));
  const unlocked = reward.newlyUnlockedPages.length
    ? h('div', { class: 'unlock', 'data-testid': 'page-unlocked' }, uiIcon('album'), '+', String(reward.newlyUnlockedPages.length))
    : null;
  const btn = (icon, testid, label, onClick, extra = '') =>
    h('button', { class: `big-btn ${extra}`, 'data-testid': testid, 'aria-label': label, onClick }, uiIcon(icon));

  root.replaceChildren(
    h('main', { class: 'round-end', 'data-testid': 'round-end' },
      h('div', { class: 'big-stars' }, uiIcon('star'), String(correct)),
      prize,
      unlocked,
      h('div', { class: 'end-actions' },
        btn('again', 'play-again', 'Nochmal', () => ctx.go('round', { exerciseId })),
        btn('album', 'to-album', 'Album', () => ctx.go('album', { highlight: reward.sticker })),
        btn('check', 'round-done', 'Fertig', () => ctx.go('menu'), 'go'))),
  );
  ctx.sounds.fanfare();
  const praise = correct >= 8 ? 'Super gemacht!' : correct >= 5 ? 'Gut gemacht!' : 'Toll geübt!';
  ctx.speech.speak(reward.sticker ? `${praise} Du hast einen neuen Sticker!` : `${praise} Du bekommst Extra-Sterne!`);
}
```

- [ ] **Step 4: Run e2e – expect pass**

Run: `npx playwright test tests/e2e/round.spec.js`
Expected: all pass (viewport test skipped on tablet).

- [ ] **Step 5: Visual check**

Screenshot mid-round at 360×640 and 1024×768 (use a small Playwright script in `_lokal/` or `page.screenshot` in a scratch test), Read the images: field square and centred, buttons readable, stars bar not wrapping awkwardly.

- [ ] **Step 6: Commit**

```bash
git add js/ui/round.js js/ui/round-end.js tests/e2e/round.spec.js
git commit -m "feat: add flash round screen and round end"
```

---

### Task 15: Sticker album screen

**Files:**
- Modify: `js/ui/album.js` (replace stub)
- Test: `tests/e2e/album.spec.js`

**Interfaces:**
- Consumes: `PAGES`, `STARS_PER_PAGE`, `stickerId`, `stickerUrl`, widgets.
- Produces: test ids `album-tab-<pageId>`, `sticker-<page>/<name>` (class `collected` when owned, `highlight` for the param), `locked-page`, `back`.

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/album.spec.js`:
```js
import { test, expect } from '@playwright/test';
import { seed } from './helpers.js';

test('album shows collected stickers and locked pages', async ({ page }) => {
  await seed(page, (p) => { p.rewards = { stars: 60, stickers: ['animals/lion', 'vehicles/bus'], unlockedPages: 2 }; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('sticker-animals/lion')).toHaveClass(/collected/);
  await expect(page.getByTestId('sticker-animals/zebra')).not.toHaveClass(/collected/);
  await page.getByTestId('album-tab-vehicles').click();
  await expect(page.getByTestId('sticker-vehicles/bus')).toHaveClass(/collected/);
  await page.getByTestId('album-tab-space').click();
  await expect(page.getByTestId('locked-page')).toContainText('100');
  await page.getByTestId('back').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
});

test('menu album button shows the sticker count', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stickers = ['animals/lion', 'animals/zebra']; });
  await page.goto('/');
  await expect(page.getByTestId('open-album')).toHaveText('2');
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npx playwright test tests/e2e/album.spec.js --project=desktop`
Expected: FAIL (stub returns to menu).

- [ ] **Step 3: Implement**

`js/ui/album.js`:
```js
import { h } from './dom.js';
import { iconBtn, starBadge, uiIcon } from './widgets.js';
import { PAGES, STARS_PER_PAGE, stickerId, stickerUrl } from '../rewards.js';

export function render(root, ctx, { highlight = null } = {}) {
  const r = ctx.profile.rewards;
  let pageIndex = highlight ? Math.max(0, PAGES.findIndex((p) => highlight.startsWith(`${p.id}/`))) : 0;
  const tabs = h('nav', { class: 'album-tabs' });
  const body = h('div', { class: 'album-page' });

  function draw() {
    tabs.replaceChildren(...PAGES.map((pg, i) => {
      const locked = i >= r.unlockedPages;
      return h('button', {
        class: `album-tab${i === pageIndex ? ' active' : ''}${locked ? ' locked' : ''}`,
        'data-testid': `album-tab-${pg.id}`,
        'aria-label': pg.title,
        onClick: () => { pageIndex = i; draw(); },
      }, h('img', { src: locked ? 'assets/ui/lock.svg' : stickerUrl(stickerId(pg.id, pg.stickers[0])), alt: '' }));
    }));
    const pg = PAGES[pageIndex];
    if (pageIndex >= r.unlockedPages) {
      const need = pageIndex * STARS_PER_PAGE;
      body.replaceChildren(h('div', { class: 'locked-page', 'data-testid': 'locked-page' },
        uiIcon('lock'), h('div', { class: 'need' }, uiIcon('star'), String(need))));
      ctx.speech.speak(`Diese Seite gibt es ab ${need} Sternen.`);
      return;
    }
    body.replaceChildren(h('div', { class: 'sticker-grid' }, pg.stickers.map((name) => {
      const id = stickerId(pg.id, name);
      const have = r.stickers.includes(id);
      return h('div', {
        class: `sticker${have ? ' collected' : ''}${id === highlight ? ' highlight' : ''}`,
        'data-testid': `sticker-${id}`,
      }, h('img', { src: stickerUrl(id), alt: '' }));
    })));
  }

  root.append(
    h('header', { class: 'topbar' }, iconBtn('back', 'Zurück', () => ctx.go('menu'), 'back'), h('div', { class: 'spacer' }), starBadge(r.stars)),
    tabs,
    body,
  );
  draw();
}
```

- [ ] **Step 4: Run e2e – expect pass**

Run: `npx playwright test tests/e2e/album.spec.js`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add js/ui/album.js tests/e2e/album.spec.js
git commit -m "feat: add sticker album screen"
```

---

### Task 16: Parent area

**Files:**
- Modify: `js/ui/parents.js` (replace stub)
- Test: `tests/e2e/parents.spec.js`

**Interfaces:**
- Consumes: `makeChallenge`, `EXERCISES`, `EXERCISE_ORDER`, `LETTERS`, profile functions, `AVATAR_LABELS`, `serializeExport`, `exportFilename`, `ImportError`, `summarize`, `avatarImg`; `ctx.store.importText`, `ctx.store.warnings`, `ctx.speech.hasGermanVoice()`.
- Produces: test ids `gate-question` (`data-answer`), `gate-answer`, `gate-submit`, `parents`, `close-parents`, `warnings`, `tab-settings|progress|profiles|data`, `ex-<id>`, `timing-adaptive|start|min|max`, `qty-max`, `qty-layout`, `digits-range`, `letter-<L>`, `letters-case`, `letters-speak`, `speech`, `sounds`, `reset-levels`, `stat-<id>`, `rename-<id>`, `delete-<id>`, `new-profile-name`, `add-profile`, `export`, `import-file`, `import-message`.

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/parents.spec.js`:
```js
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { seed, readState, longPress, openParents, buildState } from './helpers.js';

test('a short press does not open the parent area, a wrong answer returns to the menu', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await longPress(page, page.getByTestId('gear'), 800);
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  await longPress(page, page.getByTestId('gear'));
  await page.getByTestId('gate-answer').fill('1');
  await page.getByTestId('gate-submit').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
});

test('known letters can be changed and are saved', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('letter-B').check();
  await page.getByTestId('letter-A').uncheck();
  const known = (await readState(page)).profiles[0].settings.letters.known;
  expect(known.sort()).toEqual(['B', 'M', 'O']);
});

test('lowering the quantity maximum clamps the level', async ({ page }) => {
  await seed(page, (p) => { p.levels.quantity.complexity = 11; });
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('qty-max').selectOption('5');
  const p = (await readState(page)).profiles[0];
  expect(p.settings.quantity.max).toBe(5);
  expect(p.levels.quantity.complexity).toBe(5);
});

test('timing inputs are saved', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('timing-start').fill('1000');
  await page.getByTestId('timing-start').press('Enter');
  await expect.poll(async () => (await readState(page)).profiles[0].settings.timing.startMs).toBe(1000);
});

test('progress tab shows a card per exercise', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('tab-progress').click();
  for (const id of ['quantity', 'digits', 'letters']) await expect(page.getByTestId(`stat-${id}`)).toBeVisible();
});

test('export downloads a valid backup', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('tab-data').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()]);
  expect(download.suggestedFilename()).toMatch(/^blitzblick-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(data.schemaVersion).toBe(1);
  expect(data.profiles[0].name).toBe('Mia');
});

test('import replaces the state after confirmation; invalid files are rejected', async ({ page }) => {
  await seed(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('tab-data').click();
  await page.getByTestId('import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('nope') });
  await expect(page.getByTestId('import-message')).toContainText('keine gültige');
  expect((await readState(page)).profiles[0].name).toBe('Mia');
  const backup = JSON.stringify(buildState(() => {}, 'Ben'));
  await page.getByTestId('import-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByTestId('import-message')).toContainText('eingespielt');
  expect((await readState(page)).profiles[0].name).toBe('Ben');
});

test('profiles can be added, renamed and deleted; deleting the last shows the create screen', async ({ page }) => {
  await seed(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('tab-profiles').click();
  await page.getByTestId('new-profile-name').fill('Ben');
  await page.getByTestId('add-profile').click();
  expect((await readState(page)).profiles.map((p) => p.name)).toEqual(['Mia', 'Ben']);
  await page.getByTestId('rename-p1').fill('Mia-Sophie');
  await page.getByTestId('rename-p1').press('Enter');
  await expect.poll(async () => (await readState(page)).profiles[0].name).toBe('Mia-Sophie');
  const benId = (await readState(page)).profiles[1].id;
  await page.getByTestId('delete-p1').click();
  await page.getByTestId(`delete-${benId}`).click();
  expect((await readState(page)).profiles).toHaveLength(0);
  await page.getByTestId('close-parents').click();
  await expect(page.getByTestId('create-profile')).toBeVisible();
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npx playwright test tests/e2e/parents.spec.js --project=desktop`
Expected: FAIL (no gate).

- [ ] **Step 3: Implement**

`js/ui/parents.js`:
```js
import { h } from './dom.js';
import { makeChallenge } from './gate.js';
import { avatarImg } from './widgets.js';
import { EXERCISES, EXERCISE_ORDER } from '../exercises/index.js';
import { LETTERS } from '../exercises/letters.js';
import {
  AVATARS, AVATAR_LABELS, createProfile, addProfile, removeProfile, setActive,
  updateProfile, updateSettings, resetLevels,
} from '../profiles.js';
import { serializeExport, exportFilename, ImportError } from '../storage.js';
import { summarize } from '../stats.js';

const TABS = [['settings', 'Einstellungen'], ['progress', 'Fortschritt'], ['profiles', 'Profile'], ['data', 'Daten']];

export function render(root, ctx) {
  const ch = makeChallenge();
  const input = h('input', { type: 'number', inputmode: 'numeric', 'data-testid': 'gate-answer', 'aria-label': 'Ergebnis' });
  const form = h('form', {
    class: 'card gate',
    onSubmit: (e) => {
      e.preventDefault();
      if (Number(input.value) === ch.answer) renderPanel(root, ctx, 'settings');
      else ctx.go('menu');
    },
  },
  h('h1', {}, 'Elternbereich'),
  h('p', { 'data-testid': 'gate-question', 'data-answer': String(ch.answer) }, `Wie viel ist ${ch.a} × ${ch.b}?`),
  input,
  h('div', { class: 'row' },
    h('button', { type: 'button', class: 'secondary-btn', onClick: () => ctx.go('menu') }, 'Abbrechen'),
    h('button', { type: 'submit', class: 'primary-btn', 'data-testid': 'gate-submit' }, 'Weiter')));
  root.append(h('main', { class: 'center' }, form));
  input.focus();
}

function close(ctx) {
  ctx.go(ctx.profile ? 'menu' : 'profiles');
}

function renderPanel(root, ctx, tab) {
  if (!ctx.profile && (tab === 'settings' || tab === 'progress')) tab = 'profiles';
  const rerender = () => renderPanel(root, ctx, tab);
  const body = h('section', { class: 'panel-body' });
  root.replaceChildren(h('div', { class: 'parents', 'data-testid': 'parents' },
    h('header', { class: 'parents-head' },
      h('h1', {}, 'Elternbereich'),
      h('button', { class: 'primary-btn', 'data-testid': 'close-parents', onClick: () => close(ctx) }, 'Fertig')),
    warnings(ctx),
    h('nav', { class: 'tabs' }, TABS.map(([id, label]) => h('button', {
      class: `tab${id === tab ? ' active' : ''}`,
      'data-testid': `tab-${id}`,
      onClick: () => renderPanel(root, ctx, id),
    }, label))),
    body));
  ({ settings: settingsTab, progress: progressTab, profiles: profilesTab, data: dataTab })[tab](body, ctx, rerender);
}

function warnings(ctx) {
  const list = [];
  if (ctx.store.warnings.includes('unavailable')) list.push('Dieser Browser erlaubt kein dauerhaftes Speichern (z. B. privater Modus). Der Fortschritt geht beim Schließen verloren.');
  if (ctx.store.warnings.includes('corrupt')) list.push('Gespeicherte Daten waren beschädigt und wurden zurückgesetzt. Eine Kopie liegt im Browser-Speicher.');
  if (!ctx.speech.hasGermanVoice()) list.push('Keine deutsche Stimme gefunden – die Sprachausgabe bleibt stumm. Tipp: in den Geräteeinstellungen eine deutsche Stimme installieren.');
  return list.length ? h('div', { class: 'warnings', 'data-testid': 'warnings' }, list.map((t) => h('p', {}, t))) : null;
}

const fieldset = (legend, children) => h('fieldset', {}, h('legend', {}, legend), children);

const check = (label, checked, onChange, testid) => h('label', { class: 'check' },
  h('input', { type: 'checkbox', checked, 'data-testid': testid, onChange: (e) => onChange(e.target.checked) }), label);

const select = (label, value, options, onChange, testid) => h('label', { class: 'field-row' },
  h('span', {}, label),
  h('select', { 'data-testid': testid, onChange: (e) => onChange(e.target.value) },
    options.map(([v, t]) => h('option', { value: String(v), selected: String(v) === String(value) }, t))));

function settingsTab(body, ctx, rerender) {
  const p = ctx.profile;
  const s = p.settings;
  const apply = (patch) => {
    ctx.setState(updateProfile(ctx.state, p.id, (pr) => updateSettings(pr, patch)));
    rerender();
  };
  const num = (label, value, key) => h('label', { class: 'field-row' },
    h('span', {}, label),
    h('input', {
      type: 'number', min: '100', max: '5000', step: '50', value: String(value), 'data-testid': `timing-${key}`,
      onChange: (e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v) && v >= 100 && v <= 5000) apply({ timing: { [key === 'start' ? 'startMs' : `${key}Ms`]: Math.round(v / 50) * 50 } });
        else rerender();
      },
    }),
    h('span', { class: 'unit' }, 'ms'));

  body.append(
    h('h2', {}, `Einstellungen für ${p.name}`),
    fieldset('Übungsarten', EXERCISE_ORDER.map((id) => check(EXERCISES[id].title, s.exercises[id], (v) => apply({ exercises: { [id]: v } }), `ex-${id}`))),
    fieldset('Anzeigedauer', [
      check('Automatisch anpassen', s.timing.adaptive, (v) => apply({ timing: { adaptive: v } }), 'timing-adaptive'),
      num(s.timing.adaptive ? 'Startwert' : 'Feste Dauer', s.timing.startMs, 'start'),
      num('Kürzeste', s.timing.minMs, 'min'),
      num('Längste', s.timing.maxMs, 'max'),
    ]),
    fieldset('Mengen', [
      select('Höchstens', s.quantity.max, [3, 4, 5, 6, 8, 10].map((n) => [n, String(n)]), (v) => apply({ quantity: { max: Number(v) } }), 'qty-max'),
      select('Anordnung', s.quantity.layout, [['structured', 'Strukturiert (Würfel, Zehnerfeld)'], ['random', 'Zufällig verstreut'], ['mixed', 'Gemischt']], (v) => apply({ quantity: { layout: v } }), 'qty-layout'),
    ]),
    fieldset('Zahlen', [
      select('Zahlenraum', s.digits.range, [[9, '0–9'], [10, '0–10'], [20, '0–20']], (v) => apply({ digits: { range: Number(v) } }), 'digits-range'),
    ]),
    fieldset('Buchstaben', [
      h('p', { class: 'hint' }, 'Angehakte Buchstaben kennt das Kind schon – nur diese werden abgefragt (mindestens 2).'),
      h('div', { class: 'letter-grid' }, LETTERS.map((l) => h('label', { class: `letter${s.letters.known.includes(l) ? ' on' : ''}` },
        h('input', {
          type: 'checkbox', checked: s.letters.known.includes(l), 'data-testid': `letter-${l}`, 'aria-label': l,
          onChange: (e) => apply({ letters: { known: e.target.checked ? [...s.letters.known, l] : s.letters.known.filter((x) => x !== l) } }),
        }), l))),
      select('Schreibweise', s.letters.case, [['upper', 'Großbuchstaben'], ['lower', 'Kleinbuchstaben'], ['both', 'Groß und klein']], (v) => apply({ letters: { case: v } }), 'letters-case'),
      select('Aussprache', s.letters.speak, [['sound', 'Als Laut („mmm“)'], ['name', 'Als Name („em“)']], (v) => apply({ letters: { speak: v } }), 'letters-speak'),
    ]),
    fieldset('Ton', [
      check('Sprachausgabe', s.speech, (v) => apply({ speech: v }), 'speech'),
      check('Töne', s.sounds, (v) => apply({ sounds: v }), 'sounds'),
      h('button', { type: 'button', class: 'secondary-btn', onClick: () => ctx.speech.speak('Hallo! So klinge ich.') }, 'Stimme testen'),
    ]),
    fieldset('Schwierigkeit', [
      h('button', {
        type: 'button', class: 'danger-btn', 'data-testid': 'reset-levels',
        onClick: () => {
          if (!confirm('Alle Schwierigkeitsstufen auf den Anfang zurücksetzen?')) return;
          ctx.setState(updateProfile(ctx.state, p.id, resetLevels));
          rerender();
        },
      }, 'Stufen zurücksetzen'),
    ]),
  );
}

function progressTab(body, ctx) {
  const p = ctx.profile;
  body.append(h('h2', {}, `Fortschritt von ${p.name}`), h('p', {}, `Sterne: ${p.rewards.stars} · Sticker: ${p.rewards.stickers.length}`));
  for (const id of EXERCISE_ORDER) {
    const ex = EXERCISES[id];
    const lvl = p.levels[id];
    const maxC = ex.maxComplexity(p.settings);
    const c = Math.min(lvl.complexity, maxC);
    const sum = summarize(p.history, id);
    const duration = p.settings.timing.adaptive ? `${lvl.durationMs} ms` : `${p.settings.timing.startMs} ms (fest)`;
    body.append(h('div', { class: 'card stat', 'data-testid': `stat-${id}` },
      h('h3', {}, ex.title),
      h('p', {}, `Stufe ${c + 1} von ${maxC + 1} · ${ex.describeLevel(c, p.settings)} · Anzeigedauer ${duration}`),
      h('p', {}, sum.accuracy7 == null ? 'Letzte 7 Tage: noch keine Runden' : `Letzte 7 Tage: ${sum.rounds7} Runden, ${sum.accuracy7} % richtig`),
      h('div', { class: 'bars', 'aria-label': 'Runden pro Tag' }, sum.roundsByDay.map((d) => h('div', { class: 'bar', title: `${d.date}: ${d.count}` },
        h('span', { style: `height:${Math.min(100, d.count * 20)}%` }), h('small', {}, d.date.slice(8))))),
      sum.topConfusions.length
        ? h('p', {}, `Oft verwechselt: ${sum.topConfusions.map(([k, n]) => `${k.replace('>', ' → ')} (${n}×)`).join(', ')}`)
        : null));
  }
}

function profilesTab(body, ctx, rerender) {
  const { profiles, activeProfileId } = ctx.state;
  body.append(h('h2', {}, 'Profile'));
  for (const p of profiles) {
    body.append(h('div', { class: 'card profile-row', 'data-testid': `profile-row-${p.id}` },
      avatarImg(p.avatar),
      h('select', {
        'aria-label': 'Bild',
        onChange: (e) => { ctx.setState(updateProfile(ctx.state, p.id, (pr) => ({ ...pr, avatar: e.target.value }))); rerender(); },
      }, AVATARS.map((a) => h('option', { value: a, selected: a === p.avatar }, AVATAR_LABELS[a]))),
      h('input', {
        type: 'text', value: p.name, maxlength: '20', 'aria-label': 'Name', 'data-testid': `rename-${p.id}`,
        onChange: (e) => {
          const v = e.target.value.trim();
          if (v) ctx.setState(updateProfile(ctx.state, p.id, (pr) => ({ ...pr, name: v })));
          rerender();
        },
      }),
      p.id === activeProfileId
        ? h('span', { class: 'badge' }, 'aktiv')
        : h('button', { class: 'secondary-btn', onClick: () => { ctx.setState(setActive(ctx.state, p.id)); rerender(); } }, 'Auswählen'),
      h('button', {
        class: 'danger-btn', 'data-testid': `delete-${p.id}`,
        onClick: () => {
          if (!confirm(`Profil „${p.name}“ mit allem Fortschritt löschen?`)) return;
          ctx.setState(removeProfile(ctx.state, p.id));
          rerender();
        },
      }, 'Löschen')));
  }
  let avatar = AVATARS[0];
  const name = h('input', { type: 'text', maxlength: '20', placeholder: 'Name', 'data-testid': 'new-profile-name' });
  const pick = h('div', { class: 'avatar-pick small' }, AVATARS.map((a) => h('button', {
    type: 'button',
    class: `avatar-opt${a === avatar ? ' selected' : ''}`,
    'aria-label': AVATAR_LABELS[a],
    onClick: (e) => { avatar = a; [...pick.children].forEach((b) => b.classList.toggle('selected', b === e.currentTarget)); },
  }, avatarImg(a))));
  body.append(h('form', {
    class: 'card',
    onSubmit: (e) => {
      e.preventDefault();
      if (!name.value.trim()) return;
      ctx.setState(addProfile(ctx.state, createProfile({ name: name.value, avatar })));
      rerender();
    },
  }, h('h3', {}, 'Neues Profil'), name, h('div', { class: 'label' }, 'Bild'), pick,
  h('div', { class: 'row' }, h('button', { class: 'primary-btn', type: 'submit', 'data-testid': 'add-profile' }, 'Anlegen'))));
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataTab(body, ctx) {
  const msg = h('p', { class: 'form-msg', 'data-testid': 'import-message' });
  const file = h('input', {
    type: 'file', accept: 'application/json,.json', 'data-testid': 'import-file',
    onChange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const text = await f.text();
      e.target.value = '';
      if (!confirm('Sicherung einspielen? Der aktuelle Stand wird ersetzt (eine Kopie wird automatisch aufbewahrt).')) return;
      try {
        const state = ctx.store.importText(text);
        ctx.setState(state);
        msg.className = 'form-msg';
        msg.textContent = `Sicherung eingespielt: ${state.profiles.length} Profil(e).`;
      } catch (err) {
        msg.className = 'form-msg error';
        msg.textContent = err instanceof ImportError ? err.message : 'Import fehlgeschlagen.';
      }
    },
  });
  body.append(
    h('h2', {}, 'Datensicherung'),
    h('p', {}, 'Alle Profile, Einstellungen, Fortschritt und Sticker liegen nur auf diesem Gerät. Mit einer Sicherungsdatei kannst du sie aufbewahren oder auf ein anderes Gerät übertragen.'),
    h('button', { class: 'primary-btn', 'data-testid': 'export', onClick: () => download(exportFilename(), serializeExport(ctx.state)) }, 'Sicherung herunterladen'),
    h('h3', { style: 'margin-top:20px' }, 'Sicherung einspielen'),
    file,
    msg,
  );
}
```

- [ ] **Step 4: Run e2e – expect pass**

Run: `npx playwright test tests/e2e/parents.spec.js`
Expected: all pass on both projects.

- [ ] **Step 5: Run the whole suite**

Run: `npm test; npx playwright test`
Expected: all unit and e2e tests pass.

- [ ] **Step 6: Commit**

```bash
git add js/ui/parents.js tests/e2e/parents.spec.js
git commit -m "feat: add parent area with settings, progress, profiles and backup"
```

---

### Task 17: PWA – manifest, icons, service worker, offline

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `tools/update-precache.mjs`, `tools/render-icons.mjs`, `assets/icons/icon-192.png`, `assets/icons/icon-512.png`, `assets/icons/apple-touch-icon.png`
- Test: `tests/unit/precache.test.js`, `tests/e2e/offline.spec.js`

**Interfaces:**
- Produces: `listPrecache(root) → string[]` (starts with `'./'`, then sorted `./…` paths of `index.html`, `manifest.webmanifest`, everything under `js/`, `css/`, `assets/`), `computeVersion(root, list) → 10-hex string`, `renderBlock(version, list) → string`, `ROOT`. `sw.js` cache name `blitzblick-<VERSION>`.

- [ ] **Step 1: Write failing tests**

`tests/unit/precache.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listPrecache, computeVersion, renderBlock, ROOT } from '../../tools/update-precache.mjs';

test('precache list contains the core files', () => {
  const list = listPrecache(ROOT);
  for (const f of ['./', './index.html', './manifest.webmanifest', './js/app.js', './css/app.css', './assets/objects/apple.svg', './assets/icons/icon-192.png']) {
    assert.ok(list.includes(f), f);
  }
  assert.ok(!list.some((f) => f.includes('tests/') || f.includes('tools/') || f.includes('node_modules')));
});

test('sw.js precache block is up to date', () => {
  const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const list = listPrecache(ROOT);
  assert.ok(sw.includes(renderBlock(computeVersion(ROOT, list), list)), 'Precache-Liste in sw.js ist veraltet – bitte "npm run precache" ausführen.');
});
```

`tests/e2e/offline.spec.js`:
```js
import { test, expect } from '@playwright/test';
import { seed } from './helpers.js';

test('the app starts offline after the first visit', async ({ page, context }) => {
  await seed(page, (p) => { p.settings.timing = { startMs: 500, minMs: 300, maxMs: 3000, adaptive: false }; });
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  await page.getByTestId('tile-quantity').click();
  await expect(page.getByTestId('stimulus')).toBeVisible();
  await expect(page.locator('.obj').first()).toHaveJSProperty('complete', true);
});

test('manifest is valid and linked', async ({ page }) => {
  await page.goto('/');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Blitzblick');
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
});
```

- [ ] **Step 2: Run – expect failure**

Run: `npm test`
Expected: FAIL, `tools/update-precache.mjs` not found.

- [ ] **Step 3: Create manifest and icon renderer, render icons**

`manifest.webmanifest`:
```json
{
  "name": "Blitzblick",
  "short_name": "Blitzblick",
  "description": "Blitzlesen und Blitzrechnen für Erstklässler",
  "lang": "de",
  "start_url": "./",
  "scope": "./",
  "display": "fullscreen",
  "orientation": "any",
  "background_color": "#FFF7E8",
  "theme_color": "#2B59C3",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "assets/icons/icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

`tools/render-icons.mjs`:
```js
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const svg = readFileSync(new URL('../assets/icons/icon.svg', import.meta.url), 'utf8');
const targets = [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, name] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#2B59C3">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: fileURLToPath(new URL(`../assets/icons/${name}`, import.meta.url)) });
}
await browser.close();
console.log('Icons gerendert.');
```

Run: `npm run icons`
Expected: three PNG files in `assets/icons/`. Read `assets/icons/icon-192.png` to confirm it looks right.

- [ ] **Step 4: Create precache tool and service worker**

`tools/update-precache.mjs`:
```js
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOP_FILES = ['index.html', 'manifest.webmanifest'];
const DIRS = ['js', 'css', 'assets'];
const START = '// PRECACHE-START';
const END = '// PRECACHE-END';

function walk(root, dir) {
  return readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(root, `${dir}/${e.name}`) : [`${dir}/${e.name}`]));
}

export function listPrecache(root = ROOT) {
  const files = [...TOP_FILES, ...DIRS.flatMap((d) => walk(root, d))].sort();
  return ['./', ...files.map((f) => `./${f}`)];
}

export function computeVersion(root, list) {
  const hash = createHash('sha256');
  for (const f of list) {
    if (f === './') continue;
    hash.update(f);
    hash.update(readFileSync(join(root, f.slice(2))));
  }
  return hash.digest('hex').slice(0, 10);
}

export function renderBlock(version, list) {
  return `${START} (generated by tools/update-precache.mjs – do not edit)\nconst VERSION = '${version}';\nconst PRECACHE = ${JSON.stringify(list, null, 2)};\n${END}`;
}

function main() {
  const swPath = join(ROOT, 'sw.js');
  const sw = readFileSync(swPath, 'utf8').replace(/\r\n/g, '\n');
  const list = listPrecache(ROOT);
  const version = computeVersion(ROOT, list);
  writeFileSync(swPath, sw.replace(new RegExp(`${START}[\\s\\S]*?${END}`), renderBlock(version, list)));
  console.log(`sw.js: ${list.length} Dateien, Version ${version}`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
```

`sw.js`:
```js
// PRECACHE-START (generated by tools/update-precache.mjs – do not edit)
const VERSION = 'dev';
const PRECACHE = [];
// PRECACHE-END
const CACHE = `blitzblick-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k.startsWith('blitzblick-') && k !== CACHE).map((k) => caches.delete(k)),
  )));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit ?? fetch(event.request)),
  );
});
```

No `skipWaiting()`/`clients.claim()`: a new version activates only after all app windows are closed, so a running round is never reloaded (spec).

Run: `npm run precache`
Expected: `sw.js: <n> Dateien, Version <hash>`; the block in `sw.js` now lists all files.

- [ ] **Step 5: Run all tests – expect pass**

Run: `npm test; npx playwright test`
Expected: all pass, including `offline.spec.js`.

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest sw.js tools assets/icons tests/unit/precache.test.js tests/e2e/offline.spec.js
git commit -m "feat: make the app an installable offline PWA"
```

---

### Task 18: Release 1.0.0 and GitHub Pages

**Files:**
- Modify: `package.json` (`version` → `1.0.0`), `CHANGELOG.md`, `README.md`
- Modify (outside the repo): `c:\Users\matth\.github_repo\UEBERSICHT.md` (section „Privat“)

- [ ] **Step 1: Final verification**

Run: `npm run precache; npm test; npx playwright test`
Expected: everything passes, `git status` shows no change in `sw.js` after precache (otherwise commit it first).

- [ ] **Step 2: Update version, changelog, README**

`CHANGELOG.md`:
```markdown
# Changelog

## [1.0.0] – 2026-10-03
- Übungsarten Mengen, Zahlen, Buchstaben mit Blitz-Anzeige
- Automatische Schwierigkeitsanpassung (Anzeigedauer und Komplexität)
- Elternbereich: Grenzen, bekannte Buchstaben, Profile, Fortschritt, Datensicherung
- Sterne und Sammelalbum mit 5 Seiten / 40 Stickern
- Sprachausgabe (de-DE), Töne
- Installierbare Offline-App (PWA)
```
`package.json`: `"version": "1.0.0"`.
`README.md`: add after the first paragraph: `**App öffnen:** https://matthias-coder.github.io/blitzblick/ – auf dem Tablet im Browser „Zum Home-Bildschirm“ wählen.`

- [ ] **Step 3: Commit and tag**

```bash
npm run precache
git add -A
git commit -m "chore: release 1.0.0"
git tag v1.0.0
```

- [ ] **Step 4: STOP – ask Matthias before publishing**

Creating a **public** GitHub repo and enabling Pages is outward-facing. Ask: „Soll ich jetzt das öffentliche Repo `matthias-coder/blitzblick` anlegen und GitHub Pages aktivieren?“ Continue only after an explicit yes.

- [ ] **Step 5: Publish**

```bash
gh repo create matthias-coder/blitzblick --public --source . --remote origin --push --description "Blitzlesen und Blitzrechnen für Erstklässler – offline-fähige Web-App"
git push origin v1.0.0
gh api -X POST repos/matthias-coder/blitzblick/pages -f "source[branch]=main" -f "source[path]=/"
```
Expected: repo exists, Pages build starts. Check after ~1 min: `gh api repos/matthias-coder/blitzblick/pages --jq .status` → `built`; open `https://matthias-coder.github.io/blitzblick/` and confirm the welcome screen loads.

- [ ] **Step 6: Update the repo overview**

In `c:\Users\matth\.github_repo\UEBERSICHT.md`, add a row to the table in section „## Privat“ (same column format as `learning-buddy`):
```markdown
| [blitzblick](privat/blitzblick/) | Web-App für Erstklässler: Mengen, Zahlen, Buchstaben blitzen kurz auf, Kind wählt das Gesehene. Adaptive Schwierigkeit, Elternbereich, Sammelalbum. **Öffentlich** (GitHub Pages). | HTML/CSS/JS (ES-Module), PWA, Playwright | Aktiv, 1.0.0 | 2026-10-03 |
```
Also adjust the line „Alle Repos … sind privat.“ to „… sind privat (Ausnahme: blitzblick, öffentlich für GitHub Pages).“ That file is not in a git repo of its own unless it is; check with `git -C c:\Users\matth\.github_repo status` and commit only if it is tracked.

---

## Self-Review Notes

- Spec coverage: Ablauf (Task 14), Übungsarten (3–5), Anpassung (2, 9), Elternbereich inkl. Zugang, Einstellungen, Fortschritt, Sicherung, Hinweise (16, 10, 7), Album (8, 12, 15), Datenmodell + Migration (6, 7), Fehlerfälle (7, 11, 16, 17), Tests (alle), PWA/Offline/Updates (17), Repo-Konventionen (1, 18).
- Interfaces cross-checked: exercise contract identical in Tasks 3–5 and registry test (6); `createTask(level, settings, rng, roundCtx)` used by `session.nextTask`; screen contract and `ctx` used consistently in Tasks 13–16; test ids listed per task.

