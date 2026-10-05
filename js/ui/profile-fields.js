import { h } from './dom.js';
import { segmented } from './controls.js';
import { GRADES, GRADE_LABELS } from '../levels.js';
import { parseAge, gradeForAge } from '../profiles.js';

// age and grade for a new profile: the age preselects the grade until the parents pick one themselves
export function ageGradeFields(prefix) {
  let grade = GRADES[0];
  let picked = false;
  const slot = h('div', {});
  const draw = (focus = false) => {
    slot.replaceChildren(segmented('Klasse', grade, GRADES.map((g) => [g, GRADE_LABELS[g]]), (g) => {
      grade = g;
      picked = true;
      draw(true);
    }, `${prefix}grade`));
    if (focus) slot.querySelector(`[data-testid="${prefix}grade-${grade}"]`)?.focus();
  };
  const age = h('input', {
    id: `${prefix}age`, type: 'text', inputmode: 'numeric', maxlength: '2', autocomplete: 'off',
    placeholder: 'z. B. 6', 'data-testid': `${prefix}age`,
    onInput: () => {
      const g = gradeForAge(parseAge(age.value));
      if (g && !picked && g !== grade) { grade = g; draw(); }
    },
  });
  draw();
  return {
    el: [h('label', { for: `${prefix}age` }, 'Alter'), age, slot],
    values: () => ({ age: parseAge(age.value), grade }),
  };
}
