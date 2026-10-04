export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : String(c));
  }
  return el;
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// one-line text sized by its letter count can still be too wide (M, m, W): shrink it via --fit until it fits
export function fitText(el, maxWidth) {
  el.style.removeProperty('--fit');
  const width = el.offsetWidth;
  if (maxWidth > 0 && width > maxWidth) el.style.setProperty('--fit', (maxWidth / width).toFixed(3));
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// namespace-aware twin of h() for inline SVG; attributes only, no event handlers
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) if (v != null && v !== false) el.setAttribute(k, String(v));
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
