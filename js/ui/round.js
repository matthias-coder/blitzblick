import { h, wait } from './dom.js';
import { EXERCISES } from '../exercises/index.js';
import { createRound, nextTask, answerTask, finishRound, abortRound, ROUND_LENGTH } from '../session.js';
import { updateProfile } from '../profiles.js';
import { iconBtn } from './widgets.js';
import { renderRoundEnd } from './round-end.js';

// two countdown ticks fit into the fixation, the ping lands on the stimulus
export const FIXATION_MS = 900;
export const MASK_MS = 200;
export const FEEDBACK_MS = 1000;
export const SOLUTION_MS = 2500;

export function render(root, ctx, { exerciseId }) {
  const ex = EXERCISES[exerciseId];
  const rng = Math.random;
  const profile = ctx.profile;
  let round = createRound(profile, exerciseId, rng);
  let alive = true;
  let stopEnd = null;

  const stars = h('div', { class: 'round-stars', 'data-testid': 'round-stars' },
    Array.from({ length: ROUND_LENGTH }, () => h('span', { class: 'slot' })));
  // the board is one card of constant size for every exercise and phase; only its content changes
  const board = h('div', { class: 'board', 'data-testid': 'board' });
  const stage = h('div', { class: 'stage', 'data-testid': 'stage' }, board);
  const waiting = () => h('div', { class: 'board-waiting', 'data-testid': 'board-waiting' }, '?');
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
    // choices are laid out (hidden) from the start so the board keeps its size in every phase
    delete choicesEl.dataset.answer;
    choicesEl.classList.add('pending');
    ex.renderChoices(task, choicesEl, onPick);
    const stim = h('div', { class: 'stimulus preload', 'data-testid': 'stimulus' });
    ex.renderStimulus(task, stim);
    board.replaceChildren(h('div', { class: 'fixation' }), stim);
    if (round.results.length === 0) ctx.speech.speak('Pass gut auf!', { extra: true });
    ctx.sounds.ticks();
    await Promise.all([
      wait(FIXATION_MS),
      document.fonts?.ready,
      ...[...stim.querySelectorAll('img')].map((img) => img.decode().catch(() => {})),
    ]);
    if (!alive) return;
    stim.classList.remove('preload');
    board.replaceChildren(stim);
    ctx.sounds.ping();
    await wait(durationMs);
    if (!alive) return;
    board.replaceChildren(h('div', { class: 'mask' }));
    await wait(MASK_MS);
    if (!alive) return;
    board.replaceChildren(waiting());
    choicesEl.dataset.answer = String(task.answer);
    choicesEl.classList.remove('pending');
    ctx.speech.speak(ex.speakPrompt(task, profile.settings), { extra: round.results.length > 0 });
  }

  async function onPick(value, button) {
    const res = answerTask(round, profile, value);
    if (res.ignored) return;
    round = res.round;
    const slot = stars.children[round.results.length - 1];
    if (res.correct) {
      button.classList.add('right');
      board.replaceChildren(h('img', { class: 'cheer', 'data-testid': 'cheer', src: 'assets/mascot/robot-cheer.webp', alt: '' }));
      ctx.sounds.success();
      flyStar(button, slot);
      await wait(FEEDBACK_MS);
    } else {
      button.classList.add('wrong');
      choicesEl.querySelector(`[data-value="${CSS.escape(String(round.task.answer))}"]`)?.classList.add('right');
      slot.classList.add('missed');
      const solution = h('div', { class: 'stimulus solution' });
      ex.renderStimulus(round.task, solution);
      board.replaceChildren(solution);
      ctx.speech.speak(ctx.pick('solution', ex.speakSolution(round.task, profile.settings)));
      await wait(SOLUTION_MS);
    }
    if (!alive) return;
    if (res.finished) finish();
    else playTask();
  }

  // a small star flies from the tapped button into its progress slot, which then fills
  function flyStar(from, slot) {
    const earn = () => slot.classList.add('earned');
    if (!from.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { earn(); return; }
    const a = from.getBoundingClientRect(), b = slot.getBoundingClientRect();
    const star = h('img', { class: 'flying-star', src: 'assets/ui/star.svg', alt: '' });
    star.style.left = `${a.left + a.width / 2 - 24}px`;
    star.style.top = `${a.top + a.height / 2 - 24}px`;
    document.body.append(star);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    star.animate([
      { transform: 'translate(0, 0) scale(1.2)' },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 60}px) scale(1.4)`, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(.5)` },
    ], { duration: 600, easing: 'ease-in-out' }).finished.then(() => { star.remove(); earn(); }, earn);
  }

  function finish() {
    alive = false;
    const { profile: updated, reward } = finishRound(profile, round, rng);
    ctx.setState(updateProfile(ctx.state, profile.id, () => updated));
    const correct = round.results.filter((r) => r.correct).length;
    stopEnd = renderRoundEnd(root, ctx, { exerciseId, correct, reward });
  }

  playTask();
  return () => { alive = false; stopEnd?.(); };
}
