import { shuffle, pick, randInt } from '../rng.js';

export const MIN_DIST = 0.18;

const DICE = {
  1: [[0.5, 0.5]],
  2: [[0.3, 0.3], [0.7, 0.7]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
  6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
};

const centredRow = (n, y) => Array.from({ length: n }, (_, i) => [0.5 + (i - (n - 1) / 2) * 0.2, y]);

// one row up to 5; above that 5 on top and the rest below, left-aligned ("Kraft der Fünf")
function row(n) {
  if (n <= 5) return centredRow(n, 0.5);
  return Array.from({ length: n }, (_, i) => [0.1 + (i % 5) * 0.2, i < 5 ? 0.38 : 0.62]);
}

// domino columns of two
function pairs(n) {
  const cols = Math.ceil(n / 2);
  return Array.from({ length: n }, (_, i) => [0.5 + (Math.floor(i / 2) - (cols - 1) / 2) * 0.2, i % 2 ? 0.62 : 0.38]);
}

// two clusters side by side, each a small dice picture (5 = 3 + 2)
function groups(n) {
  const a = Math.ceil(n / 2);
  const cluster = (k, cx) => DICE[k].map(([x, y]) => [cx + (x - 0.5) * 0.55, 0.5 + (y - 0.5) * 0.55]);
  return [...cluster(a, 0.25), ...cluster(n - a, 0.75)];
}

function ring(n) {
  return Array.from({ length: n }, (_, i) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [0.5 + 0.32 * Math.cos(t), 0.5 + 0.32 * Math.sin(t)];
  });
}

export const PATTERNS = {
  dice: { min: 1, max: 6, fn: (n) => DICE[n] },
  row: { min: 1, max: 10, fn: row },
  pairs: { min: 2, max: 10, fn: pairs },
  groups: { min: 3, max: 8, fn: groups },
  ring: { min: 3, max: 8, fn: ring },
};

// two ten-frames on top of each other, filled row by row (11–20)
export function twentyFrame(count) {
  const ys = [0.17, 0.37, 0.63, 0.83];
  return Array.from({ length: count }, (_, i) => ({ x: 0.1 + (i % 5) * 0.2, y: ys[Math.floor(i / 5)] }));
}

// quarter turns and mirroring keep every point inside the field because all patterns are centred
function transform(pts, turns, mirror) {
  return pts.map(([x0, y0]) => {
    let x = x0, y = y0;
    for (let t = 0; t < turns; t++) [x, y] = [1 - y, x];
    return [mirror ? 1 - x : x, y];
  });
}

export const patternsFor = (count) => Object.keys(PATTERNS).filter((k) => count >= PATTERNS[k].min && count <= PATTERNS[k].max);

export function structuredPositions(count, rng, last = null) {
  const names = patternsFor(count);
  const fresh = names.filter((k) => k !== last);
  const pattern = pick(rng, fresh.length ? fresh : names);
  const pts = transform(PATTERNS[pattern].fn(count), randInt(rng, 0, 3), rng() < 0.5);
  return { pattern, positions: pts.map(([x, y]) => ({ x, y })) };
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

// ctx.lastPattern is remembered per round so the same picture does not come twice in a row
export function layoutPositions(count, mode, rng, ctx = {}) {
  if (mode === 'twenty') return twentyFrame(count);
  if (mode === 'random') return randomPositions(count, rng).map(([x, y]) => ({ x, y }));
  const { pattern, positions } = structuredPositions(count, rng, ctx.lastPattern);
  ctx.lastPattern = pattern;
  return positions;
}
