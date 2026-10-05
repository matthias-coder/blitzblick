# Compare tasks and finger pictures (1.9.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengenblitz mixes "Wo ist mehr?" compare tasks into its existing levels and shows quantities up to 10 sometimes as finger pictures.

**Architecture:** Pure task logic in a new `js/exercises/compare.js`; `quantity.js` decides per task whether to create a compare task (level config `compare` + parent toggle + per-round cap) or a finger picture (structured counts ≤ 10). Finger SVG markup comes from `js/ui/hands.js`. The session passes the played level definition into `prepareRound`, and result records carry a generic `noConfusion` flag.

**Tech Stack:** Plain ES modules, no build step; unit tests with `node --test`; E2E with Playwright (`npm run e2e`, serves on port 4173).

**Spec:** `docs/superpowers/specs/2026-10-04-compare-fingers-design.md`

## Global Constraints

- No build step, no runtime dependencies; new files are ES modules under `js/`.
- `LEVEL_COUNT = 4` per grade stays; ladders keep their steps, only an optional `compare` field is added per level.
- Compare share `0.3`, at most `2` compare tasks per round, equal share `0.2`, compare duration factor `1.5`, finger share `0.25`.
- "Gleich viel" only on levels with `equal: true`.
- Parent setting `settings.quantity.compare`, default `true`; toggle label "Vergleiche einmischen („Wo ist mehr?“)", `data-testid="quantity-compare"`.
- Speech: prompt "Wo waren mehr?"; solutions "Links waren mehr: 7 gegen 4." / "Rechts waren mehr: 7 gegen 4." / "Es waren gleich viele."
- Compare fields stay side by side in every orientation.
- Commits in this repo use the noreply identity already configured locally (`226609016+matthias-coder@users.noreply.github.com`); commit messages in English, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work happens in the worktree `_lokal/wt-1.9.0` on branch `feat/1.9.0`. The main checkout (`fix/1.8.1`, other session) must not be touched.

**Refinement of the spec (area trick):** the enlarged side (scale 1.4) is only enlarged when it has **≤ 6** objects, and its positions use a minimum distance of `MIN_DIST × 1.4`. With more objects enlarged pictures cannot be placed without overlap.

## Review Focus

1. Existing quantity/session tests that assume every quantity task has `positions` and numeric `choices` break once compare and finger tasks appear → those tests must skip or handle compare/finger tasks explicitly (Task 2, Task 4).
2. Constant or degenerate RNG (E2E stubs `Math.random`) must not hang task generation → `compareCounts` draws without rejection loops (Task 1, test "terminates with a constant rng").
3. Old stored profiles without `settings.quantity` → sanitized to `{ compare: true }`, the profile keeps loading (Task 2).
4. A wrong answer on a compare task re-renders the stimulus as solution → `renderStimulus` must handle compare/finger stimuli (Task 3/4, E2E wrong answer in Task 5).
5. Phone portrait 360×640: both compare fields side by side and inside the board (Task 5 E2E).

---

### Task 1: Compare task logic

**Files:**
- Create: `js/exercises/compare.js`
- Modify: `js/exercises/quantity-layout.js` (random layout accepts a minimum distance)
- Test: `tests/unit/compare.test.js`

**Interfaces:**
- Consumes: `randInt`, `pick` from `js/rng.js`; `layoutPositions`, `MIN_DIST` from `js/exercises/quantity-layout.js`.
- Produces:
  - `COMPARE_SHARE = 0.3`, `MAX_COMPARE_PER_ROUND = 2`, `EQUAL_SHARE = 0.2`, `AREA_SCALE = 1.4`, `AREA_MAX_COUNT = 6`, `COMPARE_DURATION_FACTOR = 1.5`
  - `compareCounts(rng, { max, minDiff, equal }) → { left, right }`
  - `createCompareTask(rng, cfg, objects, object) → task` with `stimulus: { compare: true, left, right, objectLeft, objectRight, positionsLeft, positionsRight, scaleLeft, scaleRight }`, `answer: 'left'|'right'|'equal'`, `choices`, `durationFactor: 1.5`, `exercise: 'quantity'`
  - `layoutPositions(count, 'random', rng, { minDist })` honours `ctx.minDist` (default `MIN_DIST`).

- [ ] **Step 1: Write the failing tests** — `tests/unit/compare.test.js`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCounts, createCompareTask, AREA_SCALE, AREA_MAX_COUNT, COMPARE_DURATION_FACTOR } from '../../js/exercises/compare.js';
import { MIN_DIST } from '../../js/exercises/quantity-layout.js';
import { mulberry32 } from '../../js/rng.js';

const OBJECTS = ['apple', 'duck', 'ladybug', 'fish'];
const minDistance = (pts) => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  return m;
};

test('compareCounts stays in range and keeps the minimum difference', () => {
  for (const cfg of [{ max: 6, minDiff: 3 }, { max: 10, minDiff: 2 }, { max: 10, minDiff: 1 }]) {
    for (let seed = 0; seed < 300; seed++) {
      const { left, right } = compareCounts(mulberry32(seed), cfg);
      assert.ok(left >= 1 && left <= cfg.max && right >= 1 && right <= cfg.max);
      assert.ok(Math.abs(left - right) >= cfg.minDiff, `${left}/${right}`);
    }
  }
});

test('compareCounts gives equal counts only with equal, about a fifth of the time', () => {
  let equal = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const { left, right } = compareCounts(mulberry32(seed), { max: 10, minDiff: 1, equal: true });
    if (left === right) { equal++; assert.ok(left >= 2); }
  }
  assert.ok(equal > 140 && equal < 260, String(equal));
});

test('compareCounts puts the bigger group on both sides', () => {
  const sides = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const { left, right } = compareCounts(mulberry32(seed), { max: 10, minDiff: 2 });
    sides.add(left > right ? 'left' : 'right');
  }
  assert.deepEqual([...sides].sort(), ['left', 'right']);
});

test('compareCounts terminates with a constant rng', () => {
  for (const v of [0, 0.05, 0.5, 0.999]) {
    const { left, right } = compareCounts(() => v, { max: 10, minDiff: 2 });
    assert.ok(Math.abs(left - right) >= 2);
  }
});

test('createCompareTask: different objects, matching answer and choices', () => {
  for (let seed = 0; seed < 200; seed++) {
    const t = createCompareTask(mulberry32(seed), { max: 10, minDiff: 1, equal: true }, OBJECTS, 'duck');
    const st = t.stimulus;
    assert.equal(t.exercise, 'quantity');
    assert.ok(st.compare);
    assert.notEqual(st.objectLeft, st.objectRight);
    assert.ok([st.objectLeft, st.objectRight].includes('duck'));
    assert.equal(st.positionsLeft.length, st.left);
    assert.equal(st.positionsRight.length, st.right);
    assert.equal(t.answer, st.left === st.right ? 'equal' : st.left > st.right ? 'left' : 'right');
    assert.deepEqual(t.choices, ['left', 'equal', 'right']);
    assert.equal(t.durationFactor, COMPARE_DURATION_FACTOR);
  }
  const plain = createCompareTask(mulberry32(1), { max: 6, minDiff: 3 }, OBJECTS, 'duck');
  assert.deepEqual(plain.choices, ['left', 'right']);
  assert.notEqual(plain.answer, 'equal');
});

test('createCompareTask without area keeps scale 1', () => {
  for (let seed = 0; seed < 50; seed++) {
    const st = createCompareTask(mulberry32(seed), { max: 10, minDiff: 1 }, OBJECTS, 'duck').stimulus;
    assert.equal(st.scaleLeft, 1);
    assert.equal(st.scaleRight, 1);
  }
});

test('area enlarges the smaller group (up to 6) and spaces it out', () => {
  let enlarged = 0;
  for (let seed = 0; seed < 300; seed++) {
    const st = createCompareTask(mulberry32(seed), { max: 10, minDiff: 1, equal: true, area: true }, OBJECTS, 'duck').stimulus;
    const small = Math.min(st.left, st.right);
    const scaled = [st.scaleLeft, st.scaleRight].filter((s) => s === AREA_SCALE).length;
    if (small > AREA_MAX_COUNT) { assert.equal(scaled, 0); continue; }
    assert.equal(scaled, 1);
    enlarged++;
    if (st.left !== st.right) assert.equal(st.left < st.right ? st.scaleLeft : st.scaleRight, AREA_SCALE);
    const pts = st.scaleLeft === AREA_SCALE ? st.positionsLeft : st.positionsRight;
    assert.ok(minDistance(pts) >= MIN_DIST * AREA_SCALE - 1e-9);
  }
  assert.ok(enlarged > 50);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/unit/compare.test.js`
Expected: FAIL — `Cannot find module .../js/exercises/compare.js`.

- [ ] **Step 3: Let the random layout take a minimum distance** — in `js/exercises/quantity-layout.js` replace `randomPositions` and the random branch of `layoutPositions`:

```js
// 3×3 cells 0.3 apart for spaced-out (enlarged) objects, else the jittered 4×4 grid
function fallbackGrid(count, rng, minDist) {
  if (minDist <= 0.2) return jitteredGrid(count, rng);
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push([0.2 + c * 0.3, 0.2 + r * 0.3]);
  return shuffle(rng, cells).slice(0, count);
}

function randomPositions(count, rng, minDist = MIN_DIST) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const pts = [];
    for (let tries = 0; pts.length < count && tries < 500; tries++) {
      const p = [0.1 + rng() * 0.8, 0.1 + rng() * 0.8];
      if (pts.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= minDist)) pts.push(p);
    }
    if (pts.length === count) return pts;
  }
  return fallbackGrid(count, rng, minDist);
}
```

and in `layoutPositions`:

```js
  if (mode === 'random') return randomPositions(count, rng, ctx.minDist ?? MIN_DIST).map(([x, y]) => ({ x, y }));
```

- [ ] **Step 4: Create `js/exercises/compare.js`**

```js
import { randInt, pick } from '../rng.js';
import { layoutPositions, MIN_DIST } from './quantity-layout.js';

// "Wo ist mehr?": two scattered groups of different objects, the child taps the side with more
export const COMPARE_SHARE = 0.3;
export const MAX_COMPARE_PER_ROUND = 2;
export const EQUAL_SHARE = 0.2;
export const AREA_SCALE = 1.4;
export const AREA_MAX_COUNT = 6; // more enlarged objects do not fit without overlap
export const COMPARE_DURATION_FACTOR = 1.5;

// no rejection loop, so a constant rng (E2E stub) cannot hang
export function compareCounts(rng, { max, minDiff, equal = false }) {
  if (equal && rng() < EQUAL_SHARE) {
    const n = randInt(rng, 2, max);
    return { left: n, right: n };
  }
  const small = randInt(rng, 1, max - minDiff);
  const big = randInt(rng, small + minDiff, max);
  return rng() < 0.5 ? { left: big, right: small } : { left: small, right: big };
}

// objects: the pool to draw the second object from; object: the round's object (one side keeps it)
export function createCompareTask(rng, cfg, objects, object) {
  const { left, right } = compareCounts(rng, cfg);
  const other = pick(rng, objects.filter((o) => o !== object));
  const [objectLeft, objectRight] = rng() < 0.5 ? [object, other] : [other, object];
  let scaleLeft = 1;
  let scaleRight = 1;
  if (cfg.area && Math.min(left, right) <= AREA_MAX_COUNT) {
    const leftSide = left === right ? rng() < 0.5 : left < right;
    if (leftSide) scaleLeft = AREA_SCALE; else scaleRight = AREA_SCALE;
  }
  const place = (n, scale) => layoutPositions(n, 'random', rng, { minDist: MIN_DIST * scale });
  return {
    exercise: 'quantity',
    stimulus: {
      compare: true, left, right, objectLeft, objectRight,
      positionsLeft: place(left, scaleLeft), positionsRight: place(right, scaleRight), scaleLeft, scaleRight,
    },
    answer: left === right ? 'equal' : left > right ? 'left' : 'right',
    choices: cfg.equal ? ['left', 'equal', 'right'] : ['left', 'right'],
    durationFactor: COMPARE_DURATION_FACTOR,
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/unit/compare.test.js tests/unit/quantity.test.js`
Expected: all PASS (quantity tests unchanged, random layout default behaviour identical).

- [ ] **Step 6: Commit**

```bash
git add js/exercises/compare.js js/exercises/quantity-layout.js tests/unit/compare.test.js
git commit -m "feat: compare task logic for Wo ist mehr

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Compare levels, mixing, setting and session wiring

**Files:**
- Modify: `js/exercises/quantity.js` (LADDERS, `prepareRound`, `createTask`)
- Modify: `js/session.js` (`createRound`, `answerTask`, `finishRound`)
- Modify: `js/profiles.js` (`DEFAULT_SETTINGS`, `sanitizeFields`)
- Test: `tests/unit/quantity.test.js`, `tests/unit/session.test.js`, `tests/unit/profiles.test.js`

**Interfaces:**
- Consumes: from Task 1 `createCompareTask`, `COMPARE_SHARE`, `MAX_COMPARE_PER_ROUND`.
- Produces:
  - `quantity.LADDERS[grade][level].compare` per the level table (or absent)
  - `quantity.prepareRound(rng, levelDef) → { object, lastPattern: null, compare: levelDef?.compare ?? null, compareCount: 0 }`
  - `DEFAULT_SETTINGS.quantity = { compare: true }`
  - result records `{ answer, picked, correct, noConfusion }` (replaces `add`)

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/quantity.test.js`:

```js
const levelCompare = (grade) => quantity.LADDERS[grade].map((l) => l.compare ?? null);

test('compare configs per level follow the spec table', () => {
  assert.deepEqual(levelCompare('pre'), [
    null, { max: 6, minDiff: 3 }, { max: 10, minDiff: 2 }, { max: 10, minDiff: 1, equal: true },
  ]);
  assert.deepEqual(levelCompare('g1'), [
    { max: 10, minDiff: 2 }, { max: 10, minDiff: 1, equal: true }, null, { max: 10, minDiff: 1, equal: true, area: true },
  ]);
});

test('prepareRound takes the level compare config and starts the counter at 0', () => {
  const ctx = quantity.prepareRound(mulberry32(1), quantity.LADDERS.g1[0]);
  assert.deepEqual(ctx.compare, { max: 10, minDiff: 2 });
  assert.equal(ctx.compareCount, 0);
  assert.equal(quantity.prepareRound(mulberry32(1)).compare, null);
});

const roundOf = (seed, levelDef, settings = { quantity: { compare: true } }, n = 5) => {
  const rng = mulberry32(seed);
  const ctx = quantity.prepareRound(rng, levelDef);
  return Array.from({ length: n }, () => quantity.createTask(levelDef.steps[0], settings, rng, ctx));
};

test('compare tasks are mixed in: about 30 %, never more than 2 per round', () => {
  let compares = 0;
  for (let seed = 0; seed < 400; seed++) {
    const n = roundOf(seed, quantity.LADDERS.g1[0]).filter((t) => t.stimulus.compare).length;
    assert.ok(n <= 2);
    compares += n;
  }
  const share = compares / (400 * 5);
  assert.ok(share > 0.18 && share < 0.32, String(share));
});

test('no compare tasks with the toggle off or on levels without compare', () => {
  for (let seed = 0; seed < 100; seed++) {
    assert.ok(roundOf(seed, quantity.LADDERS.g1[0], { quantity: { compare: false } }).every((t) => !t.stimulus.compare));
    assert.ok(roundOf(seed, quantity.LADDERS.pre[0]).every((t) => !t.stimulus.compare));
    assert.ok(roundOf(seed, quantity.LADDERS.g1[2]).every((t) => !t.stimulus.compare));
  }
});
```

In `tests/unit/session.test.js` replace the test `'addition mistakes are not counted as confusions'` (around line 191) — change every `add:` key in its results to `noConfusion:` — and add:

```js
test('createRound hands the played level to prepareRound', () => {
  const p = setLevel(setGrade(profile(), 'g1'), 'quantity', 0);
  const r = createRound(p, 'quantity', mulberry32(3));
  assert.deepEqual(r.ctx.compare, { max: 10, minDiff: 2 });
});

test('compare answers are marked noConfusion', () => {
  const p = setLevel(setGrade(profile(), 'g1'), 'quantity', 0);
  const rng = mulberry32(5);
  let r = createRound(p, 'quantity', rng);
  let seen = false;
  for (let i = 0; i < 30 && !seen; i++) {
    r = nextTask(r, p, rng);
    const compare = Boolean(r.task.stimulus.compare);
    r = answerTask(r, p, compare ? 'equal' : r.task.answer).round;
    const last = r.results.at(-1);
    assert.equal(last.noConfusion, compare);
    seen = compare;
  }
  assert.ok(seen);
});
```

In the test `'with fixed display duration the level set by the parents is played, on its last step'` change the loop body so compare tasks are skipped:

```js
    r = nextTask(r, p, rng);
    if (!r.task.stimulus.compare) {
      assert.ok(!r.task.stimulus.add);
      assert.deepEqual(r.task.choices.length, 10); // last step of "bis 10 mit Muster"
      counts.add(r.task.answer);
    }
    r = answerTask(r, p, r.task.answer).round;
```

Append to `tests/unit/profiles.test.js`:

```js
test('quantity.compare defaults to on and is filled in for old profiles', () => {
  assert.deepEqual(DEFAULT_SETTINGS.quantity, { compare: true });
  const old = createProfile({ name: 'Alt', avatar: 'astronaut' }, { id: 'old' });
  delete old.settings.quantity;
  assert.equal(normalizeProfile(old).settings.quantity.compare, true);
  const off = createProfile({ name: 'Aus', avatar: 'astronaut' }, { id: 'off' });
  off.settings.quantity = { compare: false };
  assert.equal(normalizeProfile(off).settings.quantity.compare, false);
});
```

`normalizeProfile`, `createProfile` and `DEFAULT_SETTINGS` are exported by `js/profiles.js`; add any of them missing from the multi-line `import { … } from '../../js/profiles.js'` at the top of `profiles.test.js`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL on the new tests (no `compare` in ladders, `prepareRound` ignores the level, no `quantity` settings, results still use `add`).

- [ ] **Step 3: Ladders and mixing in `js/exercises/quantity.js`**

Add the import:

```js
import { createCompareTask, COMPARE_SHARE, MAX_COMPARE_PER_ROUND } from './compare.js';
```

Add a helper next to `s`, `m`, `r` and replace `LADDERS`:

```js
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
```

Replace `prepareRound` and add the compare branch at the top of `createTask`:

```js
export function prepareRound(rng, levelDef) {
  return { object: pick(rng, OBJECTS), lastPattern: null, compare: levelDef?.compare ?? null, compareCount: 0 };
}

export function createTask(step, settings, rng, ctx = { object: OBJECTS[0] }) {
  if (ctx.compare && settings.quantity?.compare !== false
    && (ctx.compareCount ?? 0) < MAX_COMPARE_PER_ROUND && rng() < COMPARE_SHARE) {
    ctx.compareCount = (ctx.compareCount ?? 0) + 1;
    return createCompareTask(rng, ctx.compare, OBJECTS, ctx.object);
  }
  // … existing body unchanged
```

- [ ] **Step 4: Session wiring in `js/session.js`**

`createRound`:

```js
export function createRound(profile, exerciseId, rng) {
  const ex = EXERCISES[exerciseId];
  const level = profile.levels[exerciseId];
  const played = playableLevel(exerciseId, profile.settings, level.level);
  return {
    exerciseId,
    level,
    played,
    ctx: ex.prepareRound ? ex.prepareRound(rng, ladderOf(exerciseId, profile.settings)[played]) : {},
    results: [],
    task: null,
    durationMs: null,
    awaiting: false,
  };
}
```

In `answerTask` replace the results line:

```js
  const st = round.task.stimulus;
  const results = [...round.results, { answer: round.task.answer, picked, correct, noConfusion: Boolean(st?.add || st?.compare) }];
```

In `finishRound`:

```js
    if (r.correct || r.noConfusion) continue; // arithmetic and compare mistakes are not letter/digit confusions
```

- [ ] **Step 5: Setting in `js/profiles.js`**

In `DEFAULT_SETTINGS` after `hold`:

```js
  quantity: { compare: true },
```

In `sanitizeFields` return object after `hold`:

```js
    quantity: { compare: bool(sub('quantity').compare, d.quantity.compare) },
```

- [ ] **Step 6: Run all unit tests**

Run: `npm test`
Expected: all PASS. If another existing test asserted numeric answers for every quantity task on a level that now has `compare` (g1 L0/L1/L3, pre L1–L3), make it skip tasks with `stimulus.compare` the same way as above — do not weaken unrelated assertions.

- [ ] **Step 7: Commit**

```bash
git add js/exercises/quantity.js js/session.js js/profiles.js tests/unit
git commit -m "feat: mix compare tasks into quantity levels with a parent setting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Compare rendering, choices and speech

**Files:**
- Modify: `js/exercises/quantity.js` (`field`, `renderStimulus`, `renderChoices`, `speakPrompt`, `speakSolution`)
- Modify: `css/app.css` (after the `.plus-row` rules, ~line 142)
- Test: `tests/unit/quantity.test.js`

**Interfaces:**
- Consumes: compare task shape from Task 1.
- Produces: DOM `div.compare-row[data-testid="compare-stimulus"]` with two `.field` (style `--obj-scale`); choice buttons with `data-value` `left` / `equal` / `right` (from `renderChoiceButtons`), containing `span.compare-pick` for sides and `span.num` "=" for equal.

- [ ] **Step 1: Write the failing speech tests** (append to `tests/unit/quantity.test.js`)

```js
const cmpTask = (left, right) => ({
  stimulus: { compare: true, left, right },
  answer: left === right ? 'equal' : left > right ? 'left' : 'right',
});

test('compare speech: prompt and solutions', () => {
  assert.equal(quantity.speakPrompt(cmpTask(7, 4)), 'Wo waren mehr?');
  assert.deepEqual(quantity.speakSolution(cmpTask(7, 4)), ['Links waren mehr: 7 gegen 4.']);
  assert.deepEqual(quantity.speakSolution(cmpTask(3, 8)), ['Rechts waren mehr: 8 gegen 3.']);
  assert.deepEqual(quantity.speakSolution(cmpTask(5, 5)), ['Es waren gleich viele.']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/unit/quantity.test.js`
Expected: FAIL — prompt is "Wie viele waren es?".

- [ ] **Step 3: Implement in `js/exercises/quantity.js`**

Replace `field`, `renderStimulus`, `renderChoices`, `speakPrompt`, `speakSolution`:

```js
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
```

- [ ] **Step 4: CSS** — in `css/app.css` directly after `.plus-row .obj { … }`:

```css
/* "Wo ist mehr?": two fields side by side in every orientation */
.compare-row { width: 100%; height: 100%; display: flex; align-items: center; justify-content: space-evenly; }
.compare-row .field { width: calc(44 * min(1cqw, 1cqh)); height: calc(44 * min(1cqw, 1cqh)); outline: 3px dashed rgba(0, 0, 0, 0.08); outline-offset: -3px; border-radius: 16px; }
.compare-row .obj { width: calc(18% * var(--obj-scale, 1)); height: calc(18% * var(--obj-scale, 1)); }
.choice .compare-pick { display: block; width: 56px; height: 44px; border: 3px dashed currentColor; border-radius: 12px; opacity: 0.55; }
```

- [ ] **Step 5: Run unit tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add js/exercises/quantity.js css/app.css tests/unit/quantity.test.js
git commit -m "feat: show compare tasks side by side with field-shaped answers and speech

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Finger pictures

**Files:**
- Create: `js/ui/hands.js`
- Modify: `js/exercises/quantity-layout.js` (export `FINGER_SHARE`, `fingerHands`)
- Modify: `js/exercises/quantity.js` (`createTask` structured branch, `renderStimulus`)
- Modify: `css/app.css`
- Test: `tests/unit/hands.test.js`, `tests/unit/quantity.test.js`

**Interfaces:**
- Produces:
  - `handSvgMarkup(n) → string` (n 0–5; five `<rect class="finger up|down" …>` elements, thumb first)
  - `FINGER_SHARE = 0.25`; `fingerHands(n) → number[]` (`[n]` for n ≤ 5, `[5, n − 5]` above)
  - finger task stimulus `{ count, object, fingers: true, hands }`; DOM `div.hands[data-testid="finger-stimulus"]` with one `span.hand` per hand
- Consumes: `ctx.lastPattern` (shared with dice patterns).

- [ ] **Step 1: Write the failing tests**

`tests/unit/hands.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { handSvgMarkup } from '../../js/ui/hands.js';
import { fingerHands } from '../../js/exercises/quantity-layout.js';

const count = (s, re) => (s.match(re) ?? []).length;

test('handSvgMarkup raises exactly n of five fingers', () => {
  for (let n = 0; n <= 5; n++) {
    const svg = handSvgMarkup(n);
    assert.ok(svg.startsWith('<svg'));
    assert.equal(count(svg, /class="finger up"/g), n);
    assert.equal(count(svg, /class="finger (up|down)"/g), 5);
  }
});

test('fingerHands: one hand up to 5, a full first hand above', () => {
  assert.deepEqual(fingerHands(3), [3]);
  assert.deepEqual(fingerHands(5), [5]);
  assert.deepEqual(fingerHands(6), [5, 1]);
  assert.deepEqual(fingerHands(10), [5, 5]);
});
```

Append to `tests/unit/quantity.test.js`:

```js
test('structured counts up to 10 sometimes show fingers, never twice in a row, never scattered or twenty', () => {
  let fingers = 0;
  for (let seed = 0; seed < 100; seed++) {
    const rng = mulberry32(seed);
    const ctx = quantity.prepareRound(rng);
    let prev = false;
    for (let i = 0; i < 10; i++) {
      const t = quantity.createTask(step('g1', 0, 2), S, rng, ctx);
      const f = Boolean(t.stimulus.fingers);
      if (f) {
        fingers++;
        assert.ok(!prev);
        assert.equal(t.stimulus.hands.reduce((a, b) => a + b, 0), t.answer);
      }
      prev = f;
    }
    const scattered = quantity.createTask({ max: 10, layout: 'random' }, S, rng, quantity.prepareRound(rng));
    assert.ok(!scattered.stimulus.fingers);
  }
  assert.ok(fingers > 100 && fingers < 350, String(fingers));
});
```

Also adjust the existing test `'count is within 1..max and choices are 1..max for regular steps'`: replace the line `assert.equal(t.stimulus.positions.length, t.answer);` with

```js
        if (t.stimulus.fingers) assert.equal(t.stimulus.hands.reduce((a, b) => a + b, 0), t.answer);
        else assert.equal(t.stimulus.positions.length, t.answer);
```

and check the other existing tests in `quantity.test.js` that read `stimulus.positions` or `lastPattern` for structured steps: make them skip finger tasks (`if (t.stimulus.fingers) continue;`) without dropping their assertions.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/unit/hands.test.js tests/unit/quantity.test.js`
Expected: FAIL — `hands.js` missing, `fingerHands` not exported.

- [ ] **Step 3: Create `js/ui/hands.js`**

```js
// a cartoon hand with n raised fingers (thumb first, as children count), as SVG markup
const SKIN = 'fill="#f6c9a0" stroke="#c98f62" stroke-width="3"';

// [x, height] of index, middle, ring and little finger
const FINGERS = [[24, 46], [38, 50], [52, 46], [66, 38]];

export function handSvgMarkup(n) {
  const thumb = n >= 1
    ? `<rect class="finger up" x="2" y="44" width="13" height="38" rx="6.5" transform="rotate(-30 8 82)" ${SKIN}/>`
    : `<rect class="finger down" x="20" y="72" width="34" height="13" rx="6.5" ${SKIN}/>`;
  const fingers = FINGERS.map(([x, len], i) => (n >= i + 2
    ? `<rect class="finger up" x="${x}" y="${60 - len}" width="12" height="${len + 8}" rx="6" ${SKIN}/>`
    : `<rect class="finger down" x="${x}" y="50" width="12" height="16" rx="6" ${SKIN}/>`)).join('');
  return `<svg viewBox="0 0 90 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${fingers}`
    + `<rect x="18" y="56" width="64" height="54" rx="20" ${SKIN}/>${thumb}</svg>`;
}
```

Note: the palm is drawn after the fingers (covers finger bases) and the thumb last (folded thumb lies on the palm).

- [ ] **Step 4: `fingerHands` in `js/exercises/quantity-layout.js`** (after `PATTERNS`)

```js
// finger pictures as a further structured picture (1–10): the first hand is full above 5, as children count
export const FINGER_SHARE = 0.25;
export const fingerHands = (n) => (n <= 5 ? [n] : [5, n - 5]);
```

- [ ] **Step 5: Use it in `js/exercises/quantity.js`**

Imports:

```js
import { layoutPositions, fingerHands, FINGER_SHARE } from './quantity-layout.js';
import { handSvgMarkup } from '../ui/hands.js';
```

In `createTask`, replace the final regular block (after the `twenty` branch):

```js
  const count = randInt(rng, 1, step.max);
  const mode = step.layout === 'mixed' ? (rng() < 0.5 ? 'structured' : 'random') : step.layout;
  const choices = Array.from({ length: step.max }, (_, i) => i + 1);
  if (mode === 'structured' && count <= 10 && ctx.lastPattern !== 'fingers' && rng() < FINGER_SHARE) {
    ctx.lastPattern = 'fingers';
    return { exercise: id, stimulus: { count, object: ctx.object, fingers: true, hands: fingerHands(count) }, answer: count, choices };
  }
  return {
    exercise: id,
    stimulus: { count, object: ctx.object, positions: layoutPositions(count, mode, rng, ctx) },
    answer: count,
    choices,
  };
```

In `renderStimulus`, after the compare branch:

```js
  if (st.fingers) {
    el.replaceChildren(h('div', { class: 'hands', 'data-testid': 'finger-stimulus' }, st.hands.map((n) => {
      const hand = h('span', { class: 'hand' });
      hand.innerHTML = handSvgMarkup(n);
      return hand;
    })));
    return;
  }
```

- [ ] **Step 6: CSS** — in `css/app.css` after the compare rules:

```css
.hands { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: calc(4 * min(1cqw, 1cqh)); }
.hands .hand { width: calc(34 * min(1cqw, 1cqh)); }
.hands svg { display: block; width: 100%; height: auto; }
```

- [ ] **Step 7: Run unit tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add js/ui/hands.js js/exercises/quantity-layout.js js/exercises/quantity.js css/app.css tests/unit
git commit -m "feat: finger pictures as structured quantities up to 10

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Parent toggle and end-to-end checks

**Files:**
- Modify: `js/ui/parents.js` (settings tab, between "Anzeigedauer" and "Buchstaben" fieldsets, ~line 202)
- Test: `tests/e2e/round.spec.js`, `tests/e2e/parents.spec.js`

**Interfaces:**
- Consumes: `settings.quantity.compare` (Task 2), `compare-stimulus` / `data-value` choices (Task 3), `finger-stimulus` (Task 4).

- [ ] **Step 1: Write the failing E2E tests**

Append to `tests/e2e/round.spec.js` (uses `seed`, `waitForChoices`, `expect`, `test` already imported/defined there):

```js
// Math.random is stubbed to a constant: the first quantity task on a compare level is then a compare task
const stubRandom = (page, v = 0.05) => page.addInitScript((x) => { Math.random = () => x; }, v);
const compareLevel = (extra = () => {}) => (p) => {
  p.settings.grade = 'g1';
  p.settings.timing = { startMs: 800, minMs: 300, maxMs: 3000, adaptive: true };
  p.levels.quantity = { ...p.levels.quantity, level: 0, step: 0, durationMs: 800 };
  extra(p);
};

test('Wo ist mehr? tapping the side with more counts as correct', async ({ page }) => {
  await stubRandom(page);
  await seed(page, compareLevel());
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  await expect(page.getByTestId('compare-stimulus')).toBeVisible({ timeout: 6000 });
  const { choices, answer } = await waitForChoices(page);
  expect(['left', 'right']).toContain(answer);
  await choices.locator(`button[data-value="${answer}"]`).click();
  await expect(page.getByTestId('cheer')).toBeVisible();
});

test('Wo ist mehr? a wrong side shows both groups again as the solution', async ({ page }) => {
  await stubRandom(page);
  await seed(page, compareLevel());
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const { choices, answer } = await waitForChoices(page);
  await choices.locator(`button:not([data-value="${answer}"])`).first().click();
  await expect(page.locator('.stimulus.solution [data-testid="compare-stimulus"] .field')).toHaveCount(2);
});

test('no compare tasks when the parents switched them off', async ({ page }) => {
  await stubRandom(page);
  await seed(page, compareLevel((p) => { p.settings.quantity = { compare: false }; }));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const { answer } = await waitForChoices(page);
  expect(Number(answer)).toBeGreaterThan(0);
  await expect(page.getByTestId('compare-stimulus')).toHaveCount(0);
});

for (const [w, hgt] of [[360, 640], [640, 360]]) {
  test(`compare fields sit side by side inside the board at ${w}×${hgt}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: hgt });
    await stubRandom(page);
    await seed(page, compareLevel((p) => {
      p.settings.timing = { startMs: 3000, minMs: 3000, maxMs: 3000, adaptive: true };
      p.levels.quantity.durationMs = 3000;
    }));
    await page.goto('/');
    await page.getByTestId('tile-quantity').click();
    const fields = page.getByTestId('compare-stimulus').locator('.field');
    await expect(fields.first()).toBeVisible({ timeout: 6000 });
    const a = await fields.first().boundingBox();
    const b = await fields.last().boundingBox();
    const board = await page.getByTestId('stage').boundingBox();
    expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1); // left field ends before the right one starts
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);         // same row
    for (const f of [a, b]) {
      expect(f.x).toBeGreaterThanOrEqual(board.x - 1);
      expect(f.x + f.width).toBeLessThanOrEqual(board.x + board.width + 1);
    }
  });
}
```

Append to `tests/e2e/parents.spec.js` (uses `seed`, `openParents`, `readState`):

```js
test('parents can switch compare tasks off', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  const toggle = page.getByTestId('quantity-compare');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  const state = await readState(page);
  expect(state.profiles[0].settings.quantity.compare).toBe(false);
});
```

If the settings tab is not the default tab in the parent area, open it the same way other settings tests in `parents.spec.js` do (e.g. the `sounds` toggle test around line 227) before using the toggle.

- [ ] **Step 2: Run to verify the parent test fails**

Run: `npx playwright test tests/e2e/parents.spec.js -g "compare"`
Expected: FAIL — no element `quantity-compare`.

- [ ] **Step 3: Add the toggle in `js/ui/parents.js`** — insert before `fieldset('Buchstaben', [`:

```js
    fieldset('Mengen', [
      toggle('Vergleiche einmischen („Wo ist mehr?“)', s.quantity.compare, (v) => apply({ quantity: { compare: v } }), 'quantity-compare'),
      h('p', { class: 'hint' }, 'Ab Level 2 (Vorschule) bzw. Level 1 (Klasse 1) fragt etwa jede dritte Aufgabe, auf welcher Seite mehr waren.'),
    ]),
```

- [ ] **Step 4: Run all E2E tests**

Run: `npm run e2e`
Expected: all PASS. If a compare round test does not show `compare-stimulus` first, confirm the stub reaches the page (`page.addInitScript` before `goto`) and that `rng() < COMPARE_SHARE` is the first draw in `createTask` for a compare level.

- [ ] **Step 5: Look at it** — run `npm run serve`, open `http://localhost:4173/` in Playwright at 360×640 and 1024×700 with a g1 level-0 profile and the stub, take screenshots of a compare task (stimulus and answer buttons) and of a finger picture (seed a `pre` level-3 profile and play until `finger-stimulus` appears). Check: fields side by side, dashed answer boxes readable, hands clearly show the count. Fix CSS sizes if needed.

- [ ] **Step 6: Commit**

```bash
git add js/ui/parents.js tests/e2e
git commit -m "feat: parent toggle for compare tasks, e2e coverage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Release chores

**Files:**
- Modify: `sw.js` (via `npm run precache`), `CHANGELOG.md`, `package.json`, `package-lock.json`

- [ ] **Step 1: Precache** — Run: `npm run precache` (adds `js/exercises/compare.js` and `js/ui/hands.js`, updates `VERSION`). Then `node --test tests/unit/precache.test.js` → PASS.

- [ ] **Step 2: Version** — Run: `npm version 1.9.0 --no-git-tag-version`.

- [ ] **Step 3: Changelog** — insert at the top of `CHANGELOG.md` under `# Changelog`:

```markdown
## [1.9.0] – 2026-10-04

- Mengenblitz: „Wo ist mehr?“ – links und rechts blitzen zwei Gruppen auf, das Kind tippt die Seite mit mehr. Ab Vorschule Level 2 bzw. Klasse 1 Level 1 etwa jede dritte Aufgabe, höchstens zwei pro Runde; später auch „gleich viel“ und große Dinge in der kleineren Gruppe
- Mengenblitz: Mengen bis 10 erscheinen manchmal als Finger (eine Hand bis 5, darüber eine volle Hand plus Rest)
- Elternbereich: Schalter „Vergleiche einmischen“
```

- [ ] **Step 4: Full verification** — Run: `npm test` and `npm run e2e`. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add sw.js CHANGELOG.md package.json package-lock.json
git commit -m "chore: release notes and version 1.9.0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Merge/tag/push are **not** part of this plan: release happens after the user's OK, after `fix/1.8.1` has landed on `main` (rebase `feat/1.9.0` onto `main` first), via local `git merge --no-ff` + annotated tag with the noreply identity.
