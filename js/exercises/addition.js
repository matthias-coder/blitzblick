import { randInt } from '../rng.js';

// "Plus" stages appended on top of quantity and digits
export const ADD_SUMS = [5, 10];
export const ADD_DURATION_FACTOR = 2.5;

export function addends(rng, sum) {
  const a = randInt(rng, 1, sum - 1);
  return { a, b: randInt(rng, 1, sum - a) };
}

export function addStages(enabled, maxSum = Infinity) {
  return enabled ? ADD_SUMS.filter((sum) => sum <= maxSum).map((sum) => ({ add: true, sum })) : [];
}

export const addLabel = (sum) => `Plus bis ${sum}`;
