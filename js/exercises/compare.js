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
