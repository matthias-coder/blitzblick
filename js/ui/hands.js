// a cartoon hand with n raised fingers (thumb first, as children count), as SVG markup
const SKIN = 'fill="#f6c9a0" stroke="#c98f62" stroke-width="3"';

const PALM = `<rect x="18" y="56" width="64" height="54" rx="20" ${SKIN}/>`;

// [x, height] of index, middle, ring and little finger
const FINGERS = [[24, 46], [38, 50], [52, 46], [66, 38]];

export function handSvgMarkup(n) {
  const thumb = n >= 1
    ? `<rect class="finger up" x="14" y="52" width="13" height="38" rx="6.5" transform="rotate(-30 20.5 90)" ${SKIN}/>`
    : `<rect class="finger down" x="20" y="72" width="34" height="13" rx="6.5" ${SKIN}/>`;
  const fingers = FINGERS.map(([x, len], i) => (n >= i + 2
    ? `<rect class="finger up" x="${x}" y="${60 - len}" width="12" height="${len + 8}" rx="6" ${SKIN}/>`
    : `<rect class="finger down" x="${x}" y="50" width="12" height="16" rx="6" ${SKIN}/>`)).join('');
  return `<svg viewBox="-8 6 94 108" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${fingers}`
    + (n >= 1 ? `${thumb}${PALM}` : `${PALM}${thumb}`) + '</svg>';
}
