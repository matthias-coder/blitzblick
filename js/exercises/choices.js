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
