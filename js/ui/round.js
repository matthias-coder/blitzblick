import { h, wait } from './dom.js';
import { EXERCISES } from '../exercises/index.js';
import { createRound, nextTask, answerTask, finishRound, abortRound, ROUND_LENGTH } from '../session.js';
import { updateProfile } from '../profiles.js';
import { iconBtn } from './widgets.js';
import { renderRoundEnd } from './round-end.js';

export const FIXATION_MS = 800;
export const MASK_MS = 200;
export const FEEDBACK_MS = 1000;
export const SOLUTION_MS = 2500;

export function render(root, ctx, { exerciseId }) {
  const ex = EXERCISES[exerciseId];
  const rng = Math.random;
  const profile = ctx.profile;
  let round = createRound(profile, exerciseId, rng);
  let alive = true;

  const stars = h('div', { class: 'round-stars', 'data-testid': 'round-stars' },
    Array.from({ length: ROUND_LENGTH }, () => h('span', { class: 'slot' })));
  const stage = h('div', { class: 'stage', 'data-testid': 'stage' });
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
    choicesEl.replaceChildren();
    delete choicesEl.dataset.answer;
    const stim = h('div', { class: 'stimulus preload', 'data-testid': 'stimulus' });
    ex.renderStimulus(task, stim);
    stage.replaceChildren(h('div', { class: 'fixation' }), stim);
    if (round.results.length === 0) ctx.speech.speak('Pass gut auf!');
    await Promise.all([
      wait(FIXATION_MS),
      document.fonts?.ready,
      ...[...stim.querySelectorAll('img')].map((img) => img.decode().catch(() => {})),
    ]);
    if (!alive) return;
    stim.classList.remove('preload');
    stage.replaceChildren(stim);
    await wait(durationMs);
    if (!alive) return;
    stage.replaceChildren(h('div', { class: 'mask' }));
    await wait(MASK_MS);
    if (!alive) return;
    stage.replaceChildren();
    choicesEl.dataset.answer = String(task.answer);
    ex.renderChoices(task, choicesEl, onPick);
    ctx.speech.speak(ex.speakPrompt(task, profile.settings));
  }

  async function onPick(value, button) {
    const res = answerTask(round, profile, value);
    if (res.ignored) return;
    round = res.round;
    const slot = stars.children[round.results.length - 1];
    if (res.correct) {
      button.classList.add('right');
      slot.classList.add('earned');
      ctx.sounds.success();
      await wait(FEEDBACK_MS);
    } else {
      button.classList.add('wrong');
      choicesEl.querySelector(`[data-value="${CSS.escape(String(round.task.answer))}"]`)?.classList.add('right');
      slot.classList.add('missed');
      const solution = h('div', { class: 'stimulus solution' });
      ex.renderStimulus(round.task, solution);
      stage.replaceChildren(solution);
      ctx.speech.speak(ex.speakSolution(round.task, profile.settings));
      await wait(SOLUTION_MS);
    }
    if (!alive) return;
    if (res.finished) finish();
    else playTask();
  }

  function finish() {
    alive = false;
    const { profile: updated, reward } = finishRound(profile, round, rng);
    ctx.setState(updateProfile(ctx.state, profile.id, () => updated));
    const correct = round.results.filter((r) => r.correct).length;
    renderRoundEnd(root, ctx, { exerciseId, correct, reward });
  }

  playTask();
  return () => { alive = false; };
}
