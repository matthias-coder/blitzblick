import { LETTERS } from './letters.js';

export const VOWELS = ['A', 'E', 'I', 'O', 'U', 'Ä', 'Ö', 'Ü'];
export const MAX_CUSTOM = 50;
const VOWEL_UNITS = ['ei', 'ai', 'au', 'eu', 'äu', 'ie', 'aa', 'ee', 'oo'];
const CONSONANT_UNITS = ['sch', 'ch', 'ck', 'qu'];
// consonants that make readable consonant+vowel / vowel+consonant syllables
const CV_CONSONANTS = ['B', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W', 'Z'];
const VC_CONSONANTS = ['F', 'L', 'M', 'N', 'R', 'S', 'T'];

// built-in list: nouns and names in correct spelling, syllables split with |
export const WORDS = [
  'Ma|ma', 'Pa|pa', 'O|ma', 'O|pa', 'Tan|te', 'On|kel',
  'El|la', 'Le|a', 'Mi|a', 'O|le', 'E|mil', 'Ni|na', 'An|na', 'Ot|to', 'Li|na', 'Lo|la', 'Ti|na', 'Ti|mo',
  'Le|o', 'Ma|ra', 'Ja|na', 'Lu|ka', 'To|ni', 'Ben', 'Tom', 'Max', 'Paul', 'Lu|na', 'Mo|na', 'Li|sa', 'E|va',
  'A|mi|ra', 'Ma|ri|e', 'Sa|ra', 'Ma|ja', 'Ja|kob', 'Nils', 'Fi|ne', 'Li|a', 'No|ah', 'I|da', 'Han|na',
  'La|ma', 'Ha|se', 'E|sel', 'I|gel', 'Ka|mel', 'Wal', 'Hund', 'Kuh', 'Maus', 'Ka|ter', 'Ra|be', 'Mö|we',
  'Bär', 'Rob|be', 'Af|fe', 'En|te', 'Lö|we', 'Kat|ze', 'Ti|ger', 'Pu|ma', 'Pferd', 'Huhn', 'Fisch',
  'Ze|bra', 'Ko|a|la',
  'Ba|na|ne', 'To|ma|te', 'Me|lo|ne', 'Ro|si|ne', 'Li|mo', 'Ei', 'Eis', 'Su|pe', 'Kä|se', 'Nu|del', 'Mus',
  'Brot', 'Ku|chen', 'Piz|za', 'Ap|fel', 'Ho|nig', 'Saft', 'Milch', 'Tee',
  'So|fa', 'Ho|se', 'Ro|se', 'Na|se', 'Do|se', 'Va|se', 'Au|to', 'Ball', 'Haus', 'Hut', 'Rad', 'Ro|bo|ter',
  'Ra|ke|te', 'Mo|tor', 'Ta|fel', 'Lam|pe', 'Lu|pe', 'Na|del', 'O|fen', 'Müt|ze', 'Ta|sche',
  'Tor', 'Bus', 'Zug', 'Boot', 'Rol|ler', 'Pup|pe', 'Son|ne', 'Mond', 'Stern', 'Tul|pe', 'Ki|no',
  'Pi|rat', 'Mu|sik',
];

export const letterKey = (c) => (c === 'ß' ? 'ß' : c.toUpperCase());
const isUpper = (c) => typeof c === 'string' && c !== 'ß' && c === c.toUpperCase() && c !== c.toLowerCase();
const isVowel = (c) => VOWELS.includes(letterKey(c));

export function applyCase(chars, pattern) {
  return chars.map((c, i) => (isUpper(pattern[i]) ? letterKey(c) : c.toLowerCase())).join('');
}

function units(lower) {
  const out = [];
  let i = 0;
  while (i < lower.length) {
    const rest = lower.slice(i);
    const v = VOWEL_UNITS.find((u) => rest.startsWith(u));
    const c = v ? null : CONSONANT_UNITS.find((u) => rest.startsWith(u));
    const len = (v ?? c ?? rest[0]).length;
    out.push({ start: i, vowel: Boolean(v) || (!c && isVowel(rest[0])) });
    i += len;
  }
  return out;
}

export function syllabify(text) {
  const u = units(text.toLowerCase());
  const vi = u.flatMap((x, i) => (x.vowel ? [i] : []));
  const cuts = [];
  for (let k = 0; k < vi.length - 1; k++) {
    // no consonant between vowels: cut before the 2nd vowel; else before the last consonant
    const at = vi[k + 1] - vi[k] === 1 ? vi[k + 1] : vi[k + 1] - 1;
    cuts.push(u[at].start);
  }
  const bounds = [0, ...cuts, text.length];
  return bounds.slice(0, -1).map((b, i) => text.slice(b, bounds[i + 1]));
}

export function wordLevel(parts) {
  return parts.length === 2 && parts.every((p) => isVowel(p.at(-1))) ? 1 : 2;
}

export function parseCustomWord(input) {
  const raw = String(input ?? '').trim();
  const chars = [...raw.replaceAll('|', '')];
  if (chars.some((c) => !LETTERS.includes(letterKey(c)))) return { error: 'Nur Buchstaben (A–Z, Ä, Ö, Ü, ß) und | sind erlaubt.' };
  if (chars.length < 2 || chars.length > 12) return { error: 'Ein Wort braucht 2 bis 12 Buchstaben.' };
  const pieces = raw.split('|');
  if (pieces.some((p) => p === '')) return { error: 'Vor und nach jedem | muss ein Buchstabe stehen.' };
  const text = pieces.join('');
  const parts = pieces.length > 1 ? pieces : syllabify(text);
  return { text, split: parts.join('|') };
}

export function sanitizeCustom(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const e of list) {
    if (out.length >= MAX_CUSTOM) break;
    if (!e || typeof e !== 'object' || typeof e.text !== 'string') continue;
    const r = parseCustomWord(typeof e.split === 'string' ? e.split : e.text);
    if (r.error || r.text !== e.text) continue;
    const key = r.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function generatedSyllables(known) {
  const vowels = VOWELS.filter((v) => known.includes(v));
  const cv = CV_CONSONANTS.filter((c) => known.includes(c)).flatMap((c) => vowels.map((v) => c + v.toLowerCase()));
  const vc = VC_CONSONANTS.filter((c) => known.includes(c)).flatMap((c) => vowels.map((v) => v + c.toLowerCase()));
  return [...cv, ...vc];
}

export function buildPool(settings) {
  const known = settings.letters.known;
  const playable = (text) => [...text].every((c) => known.includes(letterKey(c)));
  const entries = new Map();
  const add = (text, parts, level) => {
    const key = text.toLowerCase();
    if (!entries.has(key) && playable(text)) entries.set(key, { text, parts, level });
  };
  for (const c of settings.syllables?.custom ?? []) {
    const parts = c.split.split('|');
    add(c.text, parts, wordLevel(parts));
  }
  for (const w of WORDS) {
    const parts = w.split('|');
    add(parts.join(''), parts, wordLevel(parts));
  }
  for (const s of generatedSyllables(known)) add(s, [s], 0);
  return [...entries.values()];
}
