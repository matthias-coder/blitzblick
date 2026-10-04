import { h } from './dom.js';
import { makeChallenge } from './gate.js';
import { avatarImg } from './widgets.js';
import { EXERCISES, EXERCISE_ORDER } from '../exercises/index.js';
import { LETTERS } from '../exercises/letters.js';
import { buildPool, parseCustomWord, letterKey, MAX_CUSTOM } from '../exercises/words.js';
import {
  AVATARS, AVATAR_LABELS, createProfile, addProfile, removeProfile, setActive,
  updateProfile, updateSettings, resetLevels, MIN_LETTERS,
} from '../profiles.js';
import { serializeExport, exportFilename, ImportError } from '../storage.js';
import { summarize } from '../stats.js';

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
    h('button', { type: 'button', class: 'secondary-btn', onClick: () => ctx.go('menu') }, 'Abbrechen'),
    h('button', { type: 'submit', class: 'primary-btn', 'data-testid': 'gate-submit' }, 'Weiter')));
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
  root.replaceChildren(h('div', { class: 'parents', 'data-testid': 'parents' },
    h('header', { class: 'parents-head' },
      h('h1', {}, 'Elternbereich'),
      h('button', { class: 'primary-btn', 'data-testid': 'close-parents', onClick: () => close(ctx) }, 'Fertig')),
    warnings(ctx),
    h('nav', { class: 'tabs' }, TABS.map(([id, label]) => h('button', {
      class: `tab${id === tab ? ' active' : ''}`,
      'data-testid': `tab-${id}`,
      onClick: () => renderPanel(root, ctx, id),
    }, label))),
    body));
  ({ settings: settingsTab, progress: progressTab, profiles: profilesTab, data: dataTab })[tab](body, ctx, rerender);
}

function warnings(ctx) {
  const list = [];
  if (ctx.store.warnings.includes('unavailable')) list.push('Dieser Browser erlaubt kein dauerhaftes Speichern (z. B. privater Modus). Der Fortschritt geht beim Schließen verloren.');
  if (ctx.store.warnings.includes('corrupt')) list.push('Gespeicherte Daten waren beschädigt und wurden zurückgesetzt. Eine Kopie liegt im Browser-Speicher.');
  if (!ctx.speech.hasGermanVoice()) list.push('Keine deutsche Stimme gefunden – die Sprachausgabe bleibt stumm. Tipp: in den Geräteeinstellungen eine deutsche Stimme installieren.');
  return list.length ? h('div', { class: 'warnings', 'data-testid': 'warnings' }, list.map((t) => h('p', {}, t))) : null;
}

const fieldset = (legend, children) => h('fieldset', {}, h('legend', {}, legend), children);

const check = (label, checked, onChange, testid, disabled = false) => h('label', { class: 'check' },
  h('input', { type: 'checkbox', checked, disabled, 'data-testid': testid, onChange: (e) => onChange(e.target.checked) }), label);

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
    check('Silben farbig zeigen (blau/rot)', s.syllables.colors, (v) => apply({ syllables: { colors: v } }), 'syllables-colors'),
    h('p', { class: 'hint', 'data-testid': 'syllables-playable' },
      `Spielbar gerade: ${nSyl} Silben, ${pool.length - nSyl} Wörter – nur aus bekannten Buchstaben.`),
    h('p', { class: 'hint' }, 'Eigene Wörter, z. B. Namen aus der Familie. Silben mit | trennen (El|la) – ohne | trennt die App selbst.'),
    h('form', { class: 'add-row', onSubmit: (e) => { e.preventDefault(); add(); } },
      input,
      h('button', { type: 'submit', class: 'secondary-btn', 'data-testid': 'syllables-custom-add' }, 'Hinzufügen')),
    msg,
    h('div', { class: 'chip-list' }, custom.map((c, i) => {
      const m = missing(c.text);
      return h('span', { class: 'chip', 'data-testid': `syllables-custom-${i}` },
        c.split.replaceAll('|', '·'),
        m.length ? h('span', { class: 'missing' }, `noch nicht spielbar – fehlt: ${m.join(', ')}`) : null,
        h('button', {
          type: 'button', 'aria-label': `${c.text} löschen`, 'data-testid': `syllables-custom-${i}-remove`,
          onClick: () => apply({ syllables: { custom: custom.filter((_, j) => j !== i) } }),
        }, '×'));
    })),
  ]);
}

function settingsTab(body, ctx, rerender) {
  const p = ctx.profile;
  const s = p.settings;
  const apply = (patch) => {
    ctx.setState(updateProfile(ctx.state, p.id, (pr) => updateSettings(pr, patch)));
    rerender();
  };
  const num = (label, value, key) => h('label', { class: 'field-row' },
    h('span', {}, label),
    h('input', {
      type: 'number', min: '100', max: '5000', step: '50', value: String(value), 'data-testid': `timing-${key}`,
      onChange: (e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v) && v >= 100 && v <= 5000) apply({ timing: { [key === 'start' ? 'startMs' : `${key}Ms`]: Math.round(v / 50) * 50 } });
        else rerender();
      },
    }),
    h('span', { class: 'unit' }, 'ms'));

  // the last enabled exercise that is also playable cannot be switched off
  const playable = EXERCISE_ORDER.filter((id) => s.exercises[id] && EXERCISES[id].isAvailable(s));
  const lockLetters = s.letters.known.length <= MIN_LETTERS;
  body.append(
    h('h2', {}, `Einstellungen für ${p.name}`),
    fieldset('Übungsarten', EXERCISE_ORDER.map((id) => check(EXERCISES[id].title, s.exercises[id], (v) => apply({ exercises: { [id]: v } }), `ex-${id}`,
      playable.length <= 1 && playable.includes(id)))),
    fieldset('Anzeigedauer', [
      check('Automatisch anpassen', s.timing.adaptive, (v) => apply({ timing: { adaptive: v } }), 'timing-adaptive'),
      num(s.timing.adaptive ? 'Startwert' : 'Feste Dauer', s.timing.startMs, 'start'),
      num('Kürzeste', s.timing.minMs, 'min'),
      num('Längste', s.timing.maxMs, 'max'),
    ]),
    fieldset('Mengen', [
      select('Höchstens', s.quantity.max, [3, 4, 5, 6, 8, 10].map((n) => [n, String(n)]), (v) => apply({ quantity: { max: Number(v) } }), 'qty-max'),
      select('Anordnung', s.quantity.layout, [['structured', 'Strukturiert (Würfel, Zehnerfeld)'], ['random', 'Zufällig verstreut'], ['mixed', 'Gemischt']], (v) => apply({ quantity: { layout: v } }), 'qty-layout'),
      check('Rechnen (Plus-Aufgaben auf den höchsten Stufen)', s.quantity.addition, (v) => apply({ quantity: { addition: v } }), 'qty-addition'),
    ]),
    fieldset('Zahlen', [
      select('Zahlenraum', s.digits.range, [[9, '0–9'], [10, '0–10'], [20, '0–20']], (v) => apply({ digits: { range: Number(v) } }), 'digits-range'),
      check('Rechnen (Plus-Aufgaben auf den höchsten Stufen)', s.digits.addition, (v) => apply({ digits: { addition: v } }), 'digits-addition'),
    ]),
    fieldset('Buchstaben', [
      h('p', { class: 'hint' }, 'Angehakte Buchstaben kennt das Kind schon – nur diese werden abgefragt (mindestens 2).'),
      h('div', { class: 'letter-grid' }, LETTERS.map((l) => h('label', { class: `letter${s.letters.known.includes(l) ? ' on' : ''}` },
        h('input', {
          type: 'checkbox', checked: s.letters.known.includes(l), disabled: lockLetters && s.letters.known.includes(l), 'data-testid': `letter-${l}`, 'aria-label': l,
          onChange: (e) => apply({ letters: { known: e.target.checked ? [...s.letters.known, l] : s.letters.known.filter((x) => x !== l) } }),
        }), l))),
      select('Schreibweise', s.letters.case, [['upper', 'Großbuchstaben'], ['lower', 'Kleinbuchstaben'], ['both', 'Groß und klein']], (v) => apply({ letters: { case: v } }), 'letters-case'),
      select('Aussprache', s.letters.speak, [['sound', 'Als Laut („mmm“)'], ['name', 'Als Name („em“)']], (v) => apply({ letters: { speak: v } }), 'letters-speak'),
    ]),
    syllablesFieldset(s, apply),
    fieldset('Ton', [
      select('Sprachausgabe', s.speech, [['off', 'Aus'], ['little', 'Wenig (nur Lösungen und Lob)'], ['lots', 'Viel (alles ansagen)']], (v) => apply({ speech: v }), 'speech'),
      voiceSelect(ctx, rerender),
      h('button', { type: 'button', class: 'secondary-btn', 'data-testid': 'voice-test', onClick: () => ctx.speech.speak('Hallo! So klinge ich.', { force: true }) }, 'Stimme testen'),
      h('p', { class: 'hint' }, 'Tipp für Android: Unter Einstellungen → Sprachausgabe → Google lassen sich natürlichere deutsche Stimmen herunterladen.'),
      check('Töne (auch Countdown vor dem Aufblitzen)', s.sounds, (v) => apply({ sounds: v }), 'sounds'),
    ]),
    fieldset('Schwierigkeit', [
      h('button', {
        type: 'button', class: 'danger-btn', 'data-testid': 'reset-levels',
        onClick: () => {
          if (!confirm('Alle Schwierigkeitsstufen auf den Anfang zurücksetzen?')) return;
          ctx.setState(updateProfile(ctx.state, p.id, resetLevels));
          rerender();
        },
      }, 'Stufen zurücksetzen'),
    ]),
  );
}

function progressTab(body, ctx) {
  const p = ctx.profile;
  body.append(h('h2', {}, `Fortschritt von ${p.name}`), h('p', {}, `Sterne: ${p.rewards.stars} · Sticker: ${p.rewards.stickers.length}`));
  for (const id of EXERCISE_ORDER) {
    const ex = EXERCISES[id];
    const lvl = p.levels[id];
    const maxC = ex.maxComplexity(p.settings);
    const c = Math.min(lvl.complexity, maxC);
    const sum = summarize(p.history, id);
    const duration = p.settings.timing.adaptive ? `${lvl.durationMs} ms` : `${p.settings.timing.startMs} ms (fest)`;
    body.append(h('div', { class: 'card stat', 'data-testid': `stat-${id}` },
      h('h3', {}, ex.title),
      h('p', {}, `Stufe ${c + 1} von ${maxC + 1} · ${ex.describeLevel(c, p.settings)} · Anzeigedauer ${duration}`),
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
        : h('button', { class: 'secondary-btn', onClick: () => { ctx.setState(setActive(ctx.state, p.id)); rerender(); } }, 'Auswählen'),
      h('button', {
        class: 'danger-btn', 'data-testid': `delete-${p.id}`,
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
    class: `avatar-opt${a === avatar ? ' selected' : ''}`,
    'aria-label': AVATAR_LABELS[a],
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
  h('div', { class: 'row' }, h('button', { class: 'primary-btn', type: 'submit', 'data-testid': 'add-profile' }, 'Anlegen'))));
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
    h('button', { class: 'primary-btn', 'data-testid': 'export', onClick: () => download(exportFilename(), serializeExport(ctx.state)) }, 'Sicherung herunterladen'),
    h('h3', { style: 'margin-top:20px' }, 'Sicherung einspielen'),
    file,
    msg,
  );
}
