export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatSeconds(ms) {
  return `${String(Math.round(ms / 10) / 100).replace('.', ',')} s`;
}
