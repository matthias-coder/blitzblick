import test from 'node:test';
import assert from 'node:assert/strict';
import * as quantity from '../../js/exercises/quantity.js';
import { layoutPositions, MIN_DIST, PATTERNS, patternsFor, structuredPositions, twentyFrame } from '../../js/exercises/quantity-layout.js';
import { mulberry32 } from '../../js/rng.js';
import { PAGES, ALL_PAGES, stickerId } from '../../js/rewards.js';

const S = { quantity: {} };
const step = (grade, level, i = 0) => quantity.LADDERS[grade][level].steps[i];
const minDistance = (pts) => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  return m;
};
const inside = (pts, lo = 0.1, hi = 0.9) => pts.every((p) => p.x >= lo - 1e-9 && p.x <= hi + 1e-9 && p.y >= lo - 1e-9 && p.y <= hi + 1e-9);

test('ladders: Vorschule from 3 with a pattern up to 10, Klasse 1 up to Plus and the Zwanzigerfeld', () => {
  assert.deepEqual(quantity.LADDERS.pre.map((l) => Math.max(...l.steps.map((s) => s.max))), [3, 5, 6, 10]);
  assert.ok(quantity.LADDERS.pre.every((l) => l.steps.every((s) => !s.add)));
  assert.ok(quantity.LADDERS.g1[2].steps.every((s) => s.add));
  assert.ok(quantity.LADDERS.g1[3].steps.every((s) => s.layout === 'twenty'));
});

test('count is within 1..max and choices are 1..max for regular steps', () => {
  for (const grade of ['pre', 'g1']) {
    for (const st of quantity.LADDERS[grade].flatMap((l) => l.steps).filter((x) => !x.add && x.layout !== 'twenty')) {
      const ctx = quantity.prepareRound(mulberry32(1));
      for (let seed = 0; seed < 100; seed++) {
        const t = quantity.createTask(st, S, mulberry32(seed), ctx);
        assert.ok(t.answer >= 1 && t.answer <= st.max);
        assert.equal(t.stimulus.count, t.answer);
        assert.equal(t.stimulus.positions.length, t.answer);
        assert.deepEqual(t.choices, Array.from({ length: st.max }, (_, i) => i + 1));
        assert.equal(t.stimulus.object, ctx.object);
      }
    }
  }
});

test('every pattern, count and turn stays inside the field and keeps the minimum distance', () => {
  for (const [name, p] of Object.entries(PATTERNS)) {
    for (let n = p.min; n <= p.max; n++) {
      for (let seed = 0; seed < 40; seed++) {
        const rng = mulberry32(seed * 31 + n);
        let pts;
        // force this pattern by excluding nothing and retrying until it comes up
        for (let k = 0; k < 200; k++) { const r = structuredPositions(n, rng); if (r.pattern === name) { pts = r.positions; break; } }
        assert.ok(pts, `${name} ${n}`);
        assert.equal(pts.length, n);
        assert.ok(inside(pts), `${name} ${n} inside`);
        if (n > 1) assert.ok(minDistance(pts) >= MIN_DIST - 1e-9, `${name} ${n} distance`);
      }
    }
  }
});

test('more than one pattern exists for every count from 2 to 10, so it is not always the dice', () => {
  for (let n = 2; n <= 10; n++) assert.ok(patternsFor(n).length >= 2, `n=${n}`);
  const seen = new Set();
  const rng = mulberry32(3);
  for (let i = 0; i < 200; i++) seen.add(structuredPositions(5, rng).pattern);
  assert.deepEqual([...seen].sort(), ['dice', 'groups', 'pairs', 'ring', 'row']);
});

test('the same pattern does not come twice in a row within a round', () => {
  const ctx = {};
  const rng = mulberry32(9);
  let last = null;
  for (let i = 0; i < 300; i++) {
    layoutPositions(1 + (i % 8) + 1, 'structured', rng, ctx);
    assert.notEqual(ctx.lastPattern, last);
    last = ctx.lastPattern;
  }
});

test('random layouts keep minimum distance and stay inside the field', () => {
  for (let seed = 0; seed < 300; seed++) {
    const pts = layoutPositions(10, 'random', mulberry32(seed));
    assert.equal(pts.length, 10);
    assert.ok(minDistance(pts) >= MIN_DIST - 1e-9);
    assert.ok(inside(pts, 0.05, 0.95));
  }
});

test('Zwanzigerfeld: two ten-frames filled row by row, inside the field, no overlap', () => {
  for (let n = 1; n <= 20; n++) {
    const pts = twentyFrame(n);
    assert.equal(pts.length, n);
    assert.ok(inside(pts));
    if (n > 1) assert.ok(minDistance(pts) >= MIN_DIST - 1e-9);
  }
  assert.ok(twentyFrame(11)[10].y > 0.5); // the 11th starts the second frame
});

test('Zwanzigerfeld tasks offer four sorted choices around the answer', () => {
  for (const st of quantity.LADDERS.g1[3].steps) {
    for (let seed = 0; seed < 100; seed++) {
      const t = quantity.createTask(st, S, mulberry32(seed), { object: 'apple' });
      assert.ok(t.answer >= st.min && t.answer <= st.max);
      assert.equal(t.stimulus.twenty, true);
      assert.equal(t.choices.length, 4);
      assert.ok(t.choices.includes(t.answer));
      assert.deepEqual(t.choices, [...t.choices].sort((a, b) => a - b));
      assert.ok(t.choices.every((c) => c >= 1 && c <= 20));
    }
  }
});

test('prepareRound picks one of the objects', () => {
  assert.ok(quantity.OBJECTS.includes(quantity.prepareRound(mulberry32(1)).object));
});

test('the object pool is the base objects plus checked stickers from the album', () => {
  assert.deepEqual(quantity.OBJECTS, [...quantity.BASE_OBJECTS, ...quantity.STICKER_OBJECTS]);
  assert.equal(new Set(quantity.OBJECTS).size, quantity.OBJECTS.length);
  const ids = new Set(ALL_PAGES.flatMap((p) => p.stickers.map((s) => stickerId(p.id, s))));
  for (const o of quantity.STICKER_OBJECTS) assert.ok(ids.has(o), `${o} is not an album sticker`);
  assert.ok(quantity.STICKER_OBJECTS.length >= 90);
});

test('stickers that are hard to count stay out of the pool', () => {
  const out = ['fruit/cherry', 'treats/grapes', 'room/pencils', 'room/flowers', 'room/sneakers', 'magic/crystals', 'blockworld/crystal',
    'toys/blocks', 'kitchen/salad', 'kitchen/cereal', 'food/spaghetti', 'blockworld/sixtyseven', 'food/birthdaycake', 'food/pizza',
    'veggies/toadstool', 'dinos/egg', 'dinos/footprint', 'kitchen/spatula', 'kitchen/whisk', 'cooking/ladle', 'magic/wand',
    'magic/broom', 'magic/telescope', 'sea/jellyfish', 'vehicles/bike', 'cooking/pan'];
  for (const o of out) assert.ok(!quantity.OBJECTS.includes(o), `${o} must not be counted`);
  assert.ok(!quantity.OBJECTS.some((o) => o.startsWith('silly/')), 'Quatschwesen stay album-only');
});

test('objectUrl maps base objects and stickers', () => {
  assert.equal(quantity.objectUrl('apple'), 'assets/objects/apple.webp');
  assert.equal(quantity.objectUrl('fruit/pear'), 'assets/stickers/fruit/pear.webp');
});

test('prepareRound reaches sticker motifs', () => {
  const rng = mulberry32(3);
  const seen = new Set(Array.from({ length: 200 }, () => quantity.prepareRound(rng).object));
  assert.ok([...seen].some((o) => o.includes('/')));
  assert.ok(seen.size > 50);
});

test('texts', () => {
  assert.equal(quantity.speakPrompt(), 'Wie viele waren es?');
  assert.equal(quantity.speakSolution({ answer: 1 })[0], 'Es war einer.');
  assert.equal(quantity.speakSolution({ answer: 6 })[0], 'Es waren 6.');
});

test('Plus tasks show two groups and ask for the sum', () => {
  const rng = mulberry32(11);
  for (let i = 0; i < 200; i++) {
    const t = quantity.createTask(step('g1', 2, 1), S, rng, { object: 'duck' });
    const { a, b } = t.stimulus;
    assert.equal(t.stimulus.add, true);
    assert.ok(a >= 1 && b >= 1 && a + b <= 10);
    assert.equal(t.answer, a + b);
    assert.equal(t.stimulus.positionsA.length, a);
    assert.equal(t.stimulus.positionsB.length, b);
    assert.deepEqual(t.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(t.durationFactor, 2.5);
  }
});

test('Plus speech says "zusammen" and names both addends', () => {
  const t = { answer: 5, stimulus: { add: true, a: 3, b: 2 } };
  assert.equal(quantity.speakPrompt(t), 'Wie viele waren es zusammen?');
  assert.deepEqual(quantity.speakSolution(t), ['3 und 2 sind 5.']);
});

test('bonus pages garden, construction and bugs are counted, everyday is not', () => {
  assert.ok(quantity.OBJECTS.includes('bugs/ladybug'));
  assert.ok(quantity.OBJECTS.includes('construction/cone'));
  assert.ok(quantity.OBJECTS.includes('garden/sunflower'));
  assert.ok(!quantity.OBJECTS.includes('garden/tulips'));
  assert.ok(!quantity.OBJECTS.some((o) => o.startsWith('everyday/')));
});

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
