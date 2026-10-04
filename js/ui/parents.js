import { h } from './dom.js';
import { makeChallenge } from './gate.js';
import { avatarImg } from './widgets.js';
import { EXERCISES, EXERCISE_ORDER } from '../exercises/index.js';
import { LETTERS } from '../exercises/letters.js';
import { buildPool, parseCustomWord, letterKey, MAX_CUSTOM } from '../exercises/words.js';
import {
  AVATARS, AVATAR_LABELS, createProfile, addProfile, removeProfile, setActive,
  updateProfile, updateSettings, resetLevels, setGrade, setLevel, MIN_LETTERS,
} from '../profiles.js';
import { GRADES, GRADE_LABELS, LEVEL_COUNT, ladderOf } from '../levels.js';
import { serializeExport, exportFilename, ImportError } from '../storage.js';
import { summarize } from '../stats.js';
import { currentLevel } from '../session.js';
import { formatSeconds } from '../util.js';
import { toggle, segmented, durationSlider } from './controls.js';

const TABS = [['settings', 'Einstellungen'], ['progress', 'Fortschritt'], ['profiles', 'Profile'], ['data', 'Daten']];

export function render(root, ctx) {
  const ch = makeChallenge();
  const input = h('input', { type: 'number', inputmode: 'numeric', 'data-testid': 'gate-answer', 'aria-label': 'Ergebnis' });
  const form = h('form', {
    class: 'card gate',
    onSubmit: (e) => {
      e.preventDefault();
      if (Number(input.value) === ch.answer) renderPanel(root, ctx, 'settings');
      else ctx.go('menu');
    },
  },
  h('h1', {}, 'Elternbereich'),
  h('p', { 'data-testid': 'gate-question', 'data-answer': String(ch.answer) }, `Wie viel ist ${ch.a} × ${ch.b}?`),
  input,
  h('div', { class: 'row' },
    h('button', { type: 'button', class: 'secondary-btn candy candy-pill', onClick: () => ctx.go('menu') }, 'Abbrechen'),
    h('button', { type: 'submit', class: 'primary-btn candy candy-pill is-primary', 'data-testid': 'gate-submit' }, 'Weiter')));
  root.append(h('main', { class: 'center' }, form));
  input.focus();
}

function close(ctx) {
  ctx.go(ctx.profile ? 'menu' : 'profiles');
}

function renderPanel(root, ctx, tab) {
  if (!ctx.profile && (tab === 'settings' || tab === 'progress')) tab = 'profiles';
  const rerender = () => renderPanel(root, ctx, tab);
  const body = h('section', { class: 'panel-body' });
  const focusId = document.activeElement?.dataset?.testid;
  const scrollTop = root.scrollTop;
  root.replaceChildren(h('div', { class: 'parents', 'data-testid': 'parents' },
    h('header', { class: 'parents-head' },
      h('h1', {}, 'Elternbereich'),
      h('button', { class: 'primary-btn candy candy-pill is-primary', 'data-testid': 'close-parents', onClick: () => close(ctx) }, 'Fertig')),
    warnings(ctx),
    h('nav', { class: 'tabs' }, TABS.map(([id, label]) => h('button', {
      class: `tab candy candy-small${id === tab ? ' is-primary' : ''}`,
      'data-testid': `tab-${id}`,
      onClick: () => renderPanel(root, ctx, id),
    }, label))),
    body));
  ({ settings: settingsTab, progress: progressTab, profiles: profilesTab, data: dataTab })[tab](body, ctx, rerender);
  root.scrollTop = scrollTop;
  if (focusId) root.querySelector(`[data-testid="${focusId}"]`)?.focus({ preventScroll: true });
}

function warnings(ctx) {
  const list = [];
  if (ctx.store.warnings.includes('unavailable')) list.push('Dieser Browser erlaubt kein dauerhaftes Speichern (z. B. privater Modus). Der Fortschritt geht beim Schließen verloren.');
  if (ctx.store.warnings.includes('corrupt')) list.push('Gespeicherte Daten waren beschädigt und wurden zurückgesetzt. Eine Kopie liegt im Browser-Speicher.');
  if (!ctx.speech.hasGermanVoice()) list.push('Keine deutsche Stimme gefunden – die Sprachausgabe bleibt stumm. Tipp: in den Geräteeinstellungen eine deutsche Stimme installieren.');
  return list.length ? h('div', { class: 'warnings', 'data-testid': 'warnings' }, list.map((t) => h('p', {}, t))) : null;
}

const fieldset = (legend, children) => h('fieldset', {}, h('legend', {}, legend), children);

const select = (label, value, options, onChange, testid) => h('label', { class: 'field-row' },
  h('span', {}, label),
  h('select', { 'data-testid': testid, onChange: (e) => onChange(e.target.value) },
    options.map(([v, t]) => h('option', { value: String(v), selected: String(v) === String(value) }, t))));

function voiceSelect(ctx, rerender) {
  const voices = ctx.speech.germanVoices();
  if (!voices.length) {
    ctx.speech.onVoicesChanged(() => { if (document.querySelector('[data-testid="parents"]')) rerender(); });
    return null;
  }
  const options = [['', `Automatisch (${voices[0].name})`], ...voices.map((v) => [v.name, v.localService === false ? `${v.name} (online)` : v.name])];
  return select('Stimme (dieses Gerät)', ctx.speech.currentVoiceName() === voices[0].name ? '' : ctx.speech.currentVoiceName(), options, (v) => {
    ctx.speech.setVoice(v || null);
    ctx.speech.speak('Hallo! So klinge ich.', { force: true });
    rerender();
  }, 'voice');
}

function syllablesFieldset(s, apply) {
  const pool = buildPool(s);
  const nSyl = pool.filter((e) => e.level === 0).length;
  const custom = s.syllables.custom;
  const msg = h('p', { class: 'form-msg', 'data-testid': 'syllables-custom-msg' });
  const input = h('input', { type: 'text', maxlength: '40', placeholder: 'z. B. El|la', 'aria-label': 'Eigenes Wort', 'data-testid': 'syllables-custom-input' });
  const fail = (text) => { msg.textContent = text; msg.classList.add('error'); };
  const add = () => {
    const r = parseCustomWord(input.value);
    if (r.error) return fail(r.error);
    if (custom.some((c) => c.text.toLowerCase() === r.text.toLowerCase())) return fail('Dieses Wort ist schon in der Liste.');
    if (custom.length >= MAX_CUSTOM) return fail(`Höchstens ${MAX_CUSTOM} eigene Wörter.`);
    return apply({ syllables: { custom: [...custom, r] } });
  };
  const missing = (text) => [...new Set([...text].map(letterKey))].filter((k) => !s.letters.known.includes(k));
  return fieldset('Silben & Wörter', [
    toggle('Silben farbig zeigen (blau/rot)', s.syllables.colors, (v) => apply({ syllables: { colors: v } }), 'syllables-colors'),
    h('p', { class: 'hint', 'data-testid': 'syllables-playable' },
      `Spielbar gerade: ${nSyl} Silben, ${pool.length - nSyl} Wörter – nur aus bekannten Buchstaben.`),
    h('p', { class: 'hint' }, 'Eigene Wörter, z. B. Namen aus der Familie. Silben mit | trennen (El|la) – ohne | trennt die App selbst.'),
    h('p', { class: 'hint' }, 'Namen und Nomen bitte groß schreiben (Ella, Ball).'),
    h('form', { class: 'add-row', onSubmit: (e) => { e.preventDefault(); add(); } },
      input,
      h('button', { type: 'submit', class: 'secondary-btn candy candy-pill', 'data-testid': 'syllables-custom-add' }, 'Hinzufügen')),
    msg,
    h('div', { class: 'chip-list' }, custom.map((c, i) => {
      const m = missing(c.text);
      return h('span', { class: 'chip', 'data-testid': `syllables-custom-${i}` },
        c.split.replaceAll('|', '·'),
        m.length ? h('span', { class: 'missing' }, `noch nicht spielbar – fehlt: ${m.join(', ')}`) : null,
        h('button', {
          type: 'button', class: 'candy candy-small', 'aria-label': `${c.text} löschen`, 'data-testid': `syllables-custom-${i}-remove`,
          onClick: () => apply({ syllables: { custom: custom.filter((_, j) => j !== i) } }),
        }, '×'));
    })),
  ]);
}

function levelsFieldset(ctx, rerender) {
  const p = ctx.profile;
  const s = p.settings;
  const lastGrade = GRADES.indexOf(s.grade) === GRADES.length - 1;
  return fieldset('Level', [
    h('p', { class: 'hint' }, 'Das gewählte Level ist der Start: Beherrscht das Kind es, geht es von selbst ein Level höher (nie tiefer). „Festhalten“ bleibt beim gewählten Level.'),
    ...EXERCISE_ORDER.map((id) => {
      const ladder = ladderOf(id, s);
      const state = p.levels[id];
      const cur = currentLevel(p, id);
      const notes = [];
      if (cur.played !== state.level) notes.push(`Gerade nicht spielbar (zu wenige bekannte Buchstaben) – gespielt wird Level ${cur.played + 1}.`);
      const done = state.level === LEVEL_COUNT - 1 && state.mastered;
      return h('div', { class: 'level-row', 'data-testid': `level-row-${id}` },
        h('h3', {}, EXERCISES[id].title),
        segmented('Level', state.level, ladder.map((_, i) => [i, String(i + 1)]), (v) => {
          ctx.setState(updateProfile(ctx.state, p.id, (pr) => setLevel(pr, id, Number(v))));
          rerender();
        }, `level-${id}`),
        h('p', { class: 'hint', 'data-testid': `level-${id}-label` }, `Level ${state.level + 1}: ${ladder[state.level].label}`),
        notes.map((t) => h('p', { class: 'hint warn' }, t)),
        done ? h('p', { class: 'hint done', 'data-testid': `level-${id}-done` },
          h('img', { src: 'assets/decor/medal.webp', alt: '' }), lastGrade ? 'Alle Level geschafft!' : 'Alle Level geschafft – nächste Klassenstufe?') : null,
        toggle('Level festhalten', s.hold[id], (v) => {
          ctx.setState(updateProfile(ctx.state, p.id, (pr) => updateSettings(pr, { hold: { [id]: v } })));
          rerender();
        }, `hold-${id}`));
    }),
  ]);
}

function settingsTab(body, ctx, rerender) {
  const p = ctx.profile;
  const s = p.settings;
  const apply = (patch) => {
    ctx.setState(updateProfile(ctx.state, p.id, (pr) => updateSettings(pr, patch)));
    rerender();
  };
  const slider = (label, key) => durationSlider(label, s.timing[`${key}Ms`], (ms) => apply({ timing: { [`${key}Ms`]: ms } }), `timing-${key}`);

  // the last enabled exercise that is also playable cannot be switched off
  const playable = EXERCISE_ORDER.filter((id) => s.exercises[id] && EXERCISES[id].isAvailable(s));
  const lockLetters = s.letters.known.length <= MIN_LETTERS;
  const changeGrade = (g) => {
    if (g === s.grade) return;
    if (!confirm(`Auf „${GRADE_LABELS[g]}“ umstellen? Alle Übungen starten dann bei Level 1 der neuen Klassenstufe.`)) { rerender(); return; }
    ctx.setState(updateProfile(ctx.state, p.id, (pr) => setGrade(pr, g)));
    rerender();
  };
  body.append(
    h('h2', {}, `Einstellungen für ${p.name}`),
    fieldset('Klassenstufe', [
      segmented('Stufe des Kindes', s.grade, GRADES.map((g) => [g, GRADE_LABELS[g]]), changeGrade, 'grade'),
      h('p', { class: 'hint' }, 'Jede Klassenstufe hat eigene Level und eigene Anzeigedauern. Sticker und Sterne bleiben beim Wechsel erhalten.'),
    ]),
    levelsFieldset(ctx, rerender),
    fieldset('Übungsarten', EXERCISE_ORDER.flatMap((id) => [
      toggle(EXERCISES[id].title, s.exercises[id], (v) => apply({ exercises: { [id]: v } }), `ex-${id}`,
        playable.length <= 1 && playable.includes(id)),
      s.exercises[id] && !EXERCISES[id].isAvailable(s)
        ? h('p', { class: 'hint', 'data-testid': `ex-${id}-hidden` }, 'Im Menü gerade ausgeblendet – zu wenige bekannte Buchstaben.')
        : null,
    ])),
    fieldset('Anzeigedauer', [
      toggle('Automatisch anpassen', s.timing.adaptive, (v) => apply({ timing: { adaptive: v } }), 'timing-adaptive'),
      slider(s.timing.adaptive ? 'Startwert' : 'Feste Dauer', 'start'),
      slider('Kürzeste', 'min'),
      slider('Längste', 'max'),
    ]),
    fieldset('Mengen', [
      toggle('Vergleiche einmischen („Wo ist mehr?“)', s.quantity.compare, (v) => apply({ quantity: { compare: v } }), 'quantity-compare'),
      h('p', { class: 'hint' }, 'Ab Level 2 (Vorschule) bzw. Level 1 (Klasse 1) fragt etwa jede dritte Aufgabe, auf welcher Seite mehr waren.'),
    ]),
    fieldset('Buchstaben', [
      h('p', { class: 'hint' }, 'Angehakte Buchstaben kennt das Kind schon – nur diese werden abgefragt (mindestens 2).'),
      h('div', { class: 'letter-grid' }, LETTERS.map((l) => h('label', { class: `letter${s.letters.known.includes(l) ? ' on' : ''}` },
        h('input', {
          type: 'checkbox', checked: s.letters.known.includes(l), disabled: lockLetters && s.letters.known.includes(l), 'data-testid': `letter-${l}`, 'aria-label': l,
          onChange: (e) => apply({ letters: { known: e.target.checked ? [...s.letters.known, l] : s.letters.known.filter((x) => x !== l) } }),
        }), l))),
      toggle('Buchstaben auf Schreiblinien zeigen (Lineatur 1)', s.letters.lineature, (v) => apply({ letters: { lineature: v } }), 'letters-lineature'),
      segmented('Aussprache', s.letters.speak, [['sound', 'Laut („mmm“)'], ['name', 'Name („em“)']], (v) => apply({ letters: { speak: v } }), 'letters-speak'),
    ]),
    syllablesFieldset(s, apply),
    fieldset('Ton', [
      segmented('Sprachausgabe', s.speech, [['off', 'Aus'], ['little', 'Wenig'], ['lots', 'Viel']], (v) => apply({ speech: v }), 'speech'),
      h('p', { class: 'hint' }, 'Wenig: nur Lösungen und Lob · Viel: alles ansagen'),
      voiceSelect(ctx, rerender),
      h('button', { type: 'button', class: 'secondary-btn candy candy-pill', 'data-testid': 'voice-test', onClick: () => ctx.speech.speak('Hallo! So klinge ich.', { force: true }) }, 'Stimme testen'),
      h('p', { class: 'hint' }, 'Tipp für Android: Unter Einstellungen → Sprachausgabe → Google lassen sich natürlichere deutsche Stimmen herunterladen.'),
      toggle('Töne (auch Countdown vor dem Aufblitzen)', s.sounds, (v) => apply({ sounds: v }), 'sounds'),
    ]),
    fieldset('Schwierigkeit', [
      h('button', {
        type: 'button', class: 'danger-btn candy candy-pill is-danger', 'data-testid': 'reset-levels',
        onClick: () => {
          if (!confirm('Alle Übungen auf Level 1 zurücksetzen?')) return;
          ctx.setState(updateProfile(ctx.state, p.id, resetLevels));
          rerender();
        },
      }, 'Alle auf Level 1 zurücksetzen'),
    ]),
  );
}

function progressTab(body, ctx) {
  const p = ctx.profile;
  body.append(h('h2', {}, `Fortschritt von ${p.name}`), h('p', {}, `Sterne: ${p.rewards.stars} (Guthaben) · Sticker: ${p.rewards.stickers.length}`));
  for (const id of EXERCISE_ORDER) {
    const ex = EXERCISES[id];
    const c = currentLevel(p, id);
    const sum = summarize(p.history, id);
    const duration = p.settings.timing.adaptive ? formatSeconds(c.durationMs) : `${formatSeconds(p.settings.timing.startMs)} (fest)`;
    const step = c.steps > 1 ? ` · Schritt ${c.step + 1} von ${c.steps}` : '';
    body.append(h('div', { class: 'card stat', 'data-testid': `stat-${id}` },
      h('h3', {}, ex.title),
      h('p', {}, `${GRADE_LABELS[p.settings.grade]} · Level ${c.played + 1} von ${LEVEL_COUNT}: ${c.label}${step} · Anzeigedauer ${duration}${p.settings.hold[id] ? ' · festgehalten' : ''}${c.mastered ? ' · beherrscht' : ''}`),
      h('p', {}, sum.accuracy7 == null ? 'Letzte 7 Tage: noch keine Runden' : `Letzte 7 Tage: ${sum.rounds7} Runden, ${sum.accuracy7} % richtig`),
      h('div', { class: 'bars', 'aria-label': 'Runden pro Tag' }, sum.roundsByDay.map((d) => h('div', { class: 'bar', title: `${d.date}: ${d.count}` },
        h('span', { style: `height:${Math.min(100, d.count * 20)}%` }), h('small', {}, d.date.slice(8))))),
      sum.topConfusions.length
        ? h('p', {}, `Oft verwechselt: ${sum.topConfusions.map(([k, n]) => `${k.replace('>', ' → ')} (${n}×)`).join(', ')}`)
        : null));
  }
}

function profilesTab(body, ctx, rerender) {
  const { profiles, activeProfileId } = ctx.state;
  body.append(h('h2', {}, 'Profile'));
  for (const p of profiles) {
    body.append(h('div', { class: 'card profile-row', 'data-testid': `profile-row-${p.id}` },
      avatarImg(p.avatar),
      h('select', {
        'aria-label': 'Bild',
        onChange: (e) => { ctx.setState(updateProfile(ctx.state, p.id, (pr) => ({ ...pr, avatar: e.target.value }))); rerender(); },
      }, AVATARS.map((a) => h('option', { value: a, selected: a === p.avatar }, AVATAR_LABELS[a]))),
      h('input', {
        type: 'text', value: p.name, maxlength: '20', 'aria-label': 'Name', 'data-testid': `rename-${p.id}`,
        onChange: (e) => {
          const v = e.target.value.trim();
          if (v) ctx.setState(updateProfile(ctx.state, p.id, (pr) => ({ ...pr, name: v })));
          rerender();
        },
      }),
      p.id === activeProfileId
        ? h('span', { class: 'badge' }, 'aktiv')
        : h('button', { class: 'secondary-btn candy candy-pill', 'data-testid': `select-${p.id}`, onClick: () => { ctx.setState(setActive(ctx.state, p.id)); rerender(); } }, 'Auswählen'),
      h('button', {
        class: 'danger-btn candy candy-pill is-danger', 'data-testid': `delete-${p.id}`,
        onClick: () => {
          if (!confirm(`Profil „${p.name}“ mit allem Fortschritt löschen?`)) return;
          ctx.setState(removeProfile(ctx.state, p.id));
          rerender();
        },
      }, 'Löschen')));
  }
  let avatar = AVATARS[0];
  const name = h('input', { type: 'text', maxlength: '20', placeholder: 'Name', 'data-testid': 'new-profile-name' });
  const pick = h('div', { class: 'avatar-pick small' }, AVATARS.map((a) => h('button', {
    type: 'button',
    class: `avatar-opt candy candy-round${a === avatar ? ' selected' : ''}`,
    'aria-label': AVATAR_LABELS[a], 'data-testid': `new-avatar-${a}`,
    onClick: (e) => { avatar = a; [...pick.children].forEach((b) => b.classList.toggle('selected', b === e.currentTarget)); },
  }, avatarImg(a))));
  body.append(h('form', {
    class: 'card',
    onSubmit: (e) => {
      e.preventDefault();
      if (!name.value.trim()) return;
      ctx.setState(addProfile(ctx.state, createProfile({ name: name.value, avatar })));
      rerender();
    },
  }, h('h3', {}, 'Neues Profil'), name, h('div', { class: 'label' }, 'Bild'), pick,
  h('div', { class: 'row' }, h('button', { class: 'primary-btn candy candy-pill is-primary', type: 'submit', 'data-testid': 'add-profile' }, 'Anlegen'))));
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataTab(body, ctx) {
  const msg = h('p', { class: 'form-msg', 'data-testid': 'import-message' });
  const file = h('input', {
    type: 'file', accept: 'application/json,.json', 'data-testid': 'import-file',
    onChange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const text = await f.text();
      e.target.value = '';
      if (!confirm('Sicherung einspielen? Der aktuelle Stand wird ersetzt (eine Kopie wird automatisch aufbewahrt).')) return;
      try {
        const state = ctx.store.importText(text);
        ctx.setState(state);
        msg.className = 'form-msg';
        msg.textContent = `Sicherung eingespielt: ${state.profiles.length} Profil(e).`;
      } catch (err) {
        msg.className = 'form-msg error';
        msg.textContent = err instanceof ImportError ? err.message : 'Import fehlgeschlagen.';
      }
    },
  });
  body.append(
    h('h2', {}, 'Datensicherung'),
    h('p', {}, 'Alle Profile, Einstellungen, Fortschritt und Sticker liegen nur auf diesem Gerät. Mit einer Sicherungsdatei kannst du sie aufbewahren oder auf ein anderes Gerät übertragen.'),
    h('button', { class: 'primary-btn candy candy-pill is-primary', 'data-testid': 'export', onClick: () => download(exportFilename(), serializeExport(ctx.state)) }, 'Sicherung herunterladen'),
    h('h3', { style: 'margin-top:20px' }, 'Sicherung einspielen'),
    file,
    msg,
  );
}
