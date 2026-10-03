import { localDate } from './util.js';

export function lastDays(today, n) {
  return Array.from({ length: n }, (_, i) => localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1 - i))));
}

export function summarize(history, exerciseId, today = new Date()) {
  const days = lastDays(today, 7);
  const own = history.filter((h) => h.exercise === exerciseId);
  const recent = own.filter((h) => h.date >= days[0] && h.date <= days[6]);
  const correct = recent.reduce((s, h) => s + h.correct, 0);
  const total = recent.reduce((s, h) => s + h.total, 0);
  const conf = {};
  for (const h of own) for (const [k, v] of Object.entries(h.confusions ?? {})) conf[k] = (conf[k] ?? 0) + v;
  return {
    accuracy7: total ? Math.round((correct / total) * 100) : null,
    rounds7: recent.length,
    roundsByDay: days.map((date) => ({ date, count: recent.filter((h) => h.date === date).length })),
    topConfusions: Object.entries(conf).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5),
  };
}
