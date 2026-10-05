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
  // keyboard: holding Enter or Space works like holding a finger on it
  const isPressKey = (e) => e.key === 'Enter' || e.key === ' ';
  el.addEventListener('keydown', (e) => {
    if (!isPressKey(e)) return;
    e.preventDefault();
    if (e.repeat || timer) return;
    el.classList.add('pressing');
    timer = setTimeout(() => { stop(); onDone(); }, ms);
  });
  el.addEventListener('keyup', (e) => { if (isPressKey(e)) stop(); });
  el.addEventListener('blur', stop);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function makeChallenge(rng = Math.random) {
  const a = randInt(rng, 3, 9);
  const b = randInt(rng, 3, 9);
  return { a, b, answer: a * b };
}
