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
