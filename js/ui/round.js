import { h, wait, fitText } from './dom.js';
import { EXERCISES } from '../exercises/index.js';
import { createRound, nextTask, answerTask, finishRound, abortRound, replayTask, ROUND_LENGTH } from '../session.js';
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
  let profile = ctx.profile;
  let round = createRound(profile, exerciseId, rng);
  let alive = true;
  let stopEnd = null;

  const stars = h('div', { class: 'round-stars', 'data-testid': 'round-stars' },
    Array.from({ length: ROUND_LENGTH }, () => h('span', { class: 'slot' })));
  // the board is one card of constant size for every exercise and phase; only its content changes
  const board = h('div', { class: 'board', 'data-testid': 'board', tabindex: '-1' });
  const stage = h('div', { class: 'stage', 'data-testid': 'stage' }, board);
  const waiting = () => h('div', { class: 'board-waiting', 'data-testid': 'board-waiting' }, '?');
  const choicesEl = h('div', { class: 'choices-area', 'data-testid': 'choices' });
  // screen readers hear the question and whether the answer was right
  const status = h('p', { class: 'sr-only', role: 'status', 'data-testid': 'round-status' });

  // #11: hear the question again (not with speech off) and see the flash once more per task
  const sayAgain = iconBtn('speaker', 'Frage nochmal hören', () => repeatPrompt(), 'say-again');
  const showAgain = iconBtn('eye', 'Nochmal zeigen', () => replay(), 'show-again');
  sayAgain.hidden = profile.settings.speech === 'off';
  const tools = h('div', { class: 'round-tools' }, sayAgain, showAgain);
  const setTools = (on) => { sayAgain.disabled = !on; showAgain.disabled = !on || Boolean(round.replayed); };
  let flashing = false;

  function abort() {
    alive = false;
    if (round.results.length) ctx.setState(updateProfile(ctx.state, profile.id, (p) => abortRound(p, round)));
    ctx.go('menu');
  }

  root.append(
    h('h1', { class: 'sr-only' }, ex.menuTitle),
    h('header', { class: 'topbar' }, iconBtn('back', 'Zurück', abort, 'back'), stars, tools),
    stage,
    choicesEl,
    status,
  );

  // fixation, stimulus, mask, then the waiting "?"; false when the screen was left meanwhile
  async function flash(task, durationMs) {
    flashing = true;
    try {
      const stim = h('div', { class: 'stimulus preload', 'data-testid': 'stimulus' });
      ex.renderStimulus(task, stim);
      board.replaceChildren(h('div', { class: 'fixation' }), stim);
      ctx.sounds.ticks();
      await Promise.all([
        wait(FIXATION_MS),
        document.fonts?.ready,
        ...[...stim.querySelectorAll('img')].map((img) => img.decode().catch(() => {})),
      ]);
      if (!alive) return false;
      fitWords(stim);
      stim.classList.remove('preload');
      board.replaceChildren(stim);
      ctx.sounds.ping();
      await wait(durationMs);
      if (!alive) return false;
      board.replaceChildren(h('div', { class: 'mask' }));
      await wait(MASK_MS);
      if (!alive) return false;
      board.replaceChildren(waiting());
      return true;
    } finally {
      flashing = false;
    }
  }

  function showAnswers(task) {
    choicesEl.dataset.answer = String(task.answer);
    choicesEl.classList.remove('pending');
    setTools(true);
  }

  async function playTask() {
    round = nextTask(round, profile, rng);
    const { task, durationMs } = round;
    // choices are laid out (hidden) from the start so the board keeps its size in every phase
    delete choicesEl.dataset.answer;
    status.textContent = '';
    setTools(false);
    choicesEl.classList.add('pending');
    ex.renderChoices(task, choicesEl, onPick);
    if (round.results.length === 0) ctx.speech.speak('Pass gut auf!', { extra: true });
    if (!(await flash(task, durationMs))) return;
    showAnswers(task);
    const prompt = ex.speakPrompt(task, profile.settings);
    status.textContent = prompt;
    // a keyboard player answered the last task: hand the focus to the new answers
    if (document.activeElement === board) choicesEl.querySelector('button.choice')?.focus();
    ctx.speech.speak(prompt, { extra: round.results.length > 0 });
  }

  function repeatPrompt() {
    if (!round.awaiting || flashing) return;
    ctx.speech.speak(ex.speakPrompt(round.task, profile.settings));
  }

  async function replay() {
    if (flashing) return;
    const next = replayTask(round);
    if (next === round) return;
    round = next;
    // the eye button gets disabled: park the focus on the board, the answers take it back afterwards
    if (tools.contains(document.activeElement)) board.focus({ preventScroll: true });
    setTools(false);
    choicesEl.classList.add('pending');
    if (!(await flash(round.task, round.durationMs))) return;
    showAnswers(round.task);
    if (document.activeElement === board) choicesEl.querySelector('button.choice')?.focus();
  }

  async function onPick(value, button) {
    const res = answerTask(round, profile, value);
    if (res.ignored) return;
    round = res.round;
    setTools(false);
    // the answer buttons are disabled now; keep the focus inside the round instead of losing it to the page
    if (choicesEl.contains(document.activeElement)) board.focus({ preventScroll: true });
    status.textContent = res.correct ? 'Richtig!' : `Leider falsch. Richtig ist ${round.task.answer}.`;
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
      fitWords(solution);
      ctx.speech.speak(ctx.pick('solution', ex.speakSolution(round.task, profile.settings)));
      await wait(SOLUTION_MS);
    }
    if (!alive) return;
    if (res.finished) finish();
    else playTask();
  }

  // words on the board and on the answer buttons must never be cut off
  function fitWords(stim) {
    for (const w of stim.querySelectorAll('.flash-word')) fitText(w, board.clientWidth * 0.94);
    for (const w of choicesEl.querySelectorAll('.choice .word')) fitText(w, w.parentElement.clientWidth - 16);
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
    stopEnd = renderRoundEnd(root, ctx, { exerciseId, level: round.played, correct, reward });
  }

  playTask();
  return () => { alive = false; stopEnd?.(); };
}
