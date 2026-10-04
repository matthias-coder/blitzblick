import { svg } from './dom.js';

// Playwrite DE Grund 400 per em, measured in Chromium: x-height, ascender (= cap height) and descender
export const SCHOOL_METRICS = { x: 0.531, asc: 0.9375, desc: 0.4375 };

// Lineatur bands follow the font, so the letter sits exactly on the lines: middle band = x-height
export function bands(metrics = SCHOOL_METRICS, mid = 100) {
  return {
    upper: (mid * (metrics.asc - metrics.x)) / metrics.x,
    mid,
    lower: (mid * metrics.desc) / metrics.x,
    fontSize: mid / metrics.x,
  };
}

// school lineature 1: four lines, shaded middle band, red baseline and the little house at the left margin
// (roof = upper band, house = middle band, cellar = lower band)
export function lineatur(text, { metrics = SCHOOL_METRICS, width = 320 } = {}) {
  const b = bands(metrics);
  const pad = 12;
  const y1 = pad, y2 = y1 + b.upper, y3 = y2 + b.mid, y4 = y3 + b.lower;
  const hw = Math.round(b.upper * 0.95), hx = 8;
  const line = (y, cls) => svg('line', { class: cls, x1: 0, x2: width, y1: y, y2: y });
  return svg('svg', { class: 'lineatur', viewBox: `0 0 ${width} ${y4 + pad}`, role: 'img', 'aria-label': text, 'data-testid': 'lineatur' },
    svg('rect', { class: 'lin-mid', x: 0, y: y2, width, height: b.mid }),
    line(y1, 'lin-line'), line(y2, 'lin-line'), line(y4, 'lin-line'), line(y3, 'lin-base'),
    svg('g', { class: 'lin-house', 'aria-hidden': 'true' },
      svg('path', { class: 'lin-roof', d: `M${hx} ${y2} L${hx + hw / 2} ${y1 + 2} L${hx + hw} ${y2} Z` }),
      svg('rect', { class: 'lin-wall', x: hx + 3, y: y2, width: hw - 6, height: b.mid }),
      svg('rect', { class: 'lin-door', x: hx + hw * 0.36, y: y2 + b.mid * 0.45, width: hw * 0.28, height: b.mid * 0.55 }),
      svg('rect', { class: 'lin-cellar', x: hx + 3, y: y3, width: hw - 6, height: b.lower })),
    svg('text', { class: 'lin-text', x: (hx + hw + width) / 2, y: y3, 'font-size': b.fontSize.toFixed(1), 'text-anchor': 'middle' }, text));
}
