import { randInt } from '../rng.js';

// Plus and Minus tasks; they are shown 2.5× as long as plain ones
export const ARITH_DURATION_FACTOR = 2.5;

export function addends(rng, sum) {
  const a = randInt(rng, 1, sum - 1);
  return { a, b: randInt(rng, 1, sum - a) };
}

// a − b with a ≤ max and a result ≥ 0
export function minusPair(rng, max) {
  const a = randInt(rng, 1, max);
  return { a, b: randInt(rng, 1, a) };
}

export const addLabel = (sum) => `Plus bis ${sum}`;
export const MINUS_SIGN = '–';
