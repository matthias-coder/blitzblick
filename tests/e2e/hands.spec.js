import { test, expect } from '@playwright/test';

const STROKE = 1.5; // half of the 3-unit stroke the hands are drawn with

// every drawn shape (incl. its stroke and rotation) must lie inside the SVG viewBox, otherwise the picture is cut off
for (const n of [0, 1, 2, 3, 4, 5]) {
  test(`finger picture with ${n} finger(s) is drawn completely inside its viewBox`, async ({ page }) => {
    await page.goto('/');
    const res = await page.evaluate(async ({ n, stroke }) => {
      const { handSvgMarkup } = await import('/js/ui/hands.js');
      const box = document.createElement('div');
      box.style.width = '200px';
      box.innerHTML = handSvgMarkup(n);
      document.body.append(box);
      const svg = box.querySelector('svg');
      const vb = svg.viewBox.baseVal;
      const out = [];
      for (const el of svg.querySelectorAll('rect')) {
        const bb = el.getBBox();
        const m = el.transform.baseVal.numberOfItems ? el.transform.baseVal.consolidate().matrix : new DOMMatrix();
        const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]]
          .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
        const xs = pts.map((q) => q[0]);
        const ys = pts.map((q) => q[1]);
        out.push({
          cls: el.getAttribute('class') || 'palm',
          thumb: el.hasAttribute('transform'),
          x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys),
          left: Math.min(...xs) - stroke - vb.x,
          top: Math.min(...ys) - stroke - vb.y,
          right: vb.x + vb.width - (Math.max(...xs) + stroke),
          bottom: vb.y + vb.height - (Math.max(...ys) + stroke),
        });
      }
      return out;
    }, { n, stroke: STROKE });
    expect(res.length).toBe(6); // 5 fingers or thumb + palm
    if (n >= 1) { // a raised thumb grows out of the palm: its box overlaps the palm's box (no gap)
      const thumb = res.find((r) => r.thumb);
      const palm = res.find((r) => r.cls === 'palm');
      expect(thumb.x1, 'thumb reaches the palm horizontally').toBeGreaterThan(palm.x0);
      expect(thumb.y1, 'thumb reaches the palm vertically').toBeGreaterThan(palm.y0);
    }
    for (const r of res) {
      for (const side of ['left', 'top', 'right', 'bottom']) {
        expect(r[side], `${r.cls} ${side} margin`).toBeGreaterThanOrEqual(0);
      }
    }
  });
}

test('two hands (a full hand plus the rest) render side by side', async ({ page }) => {
  await page.goto('/');
  const [a, b] = await page.evaluate(async () => {
    const { handSvgMarkup } = await import('/js/ui/hands.js');
    document.body.innerHTML = '<div class="hands" style="width:400px;display:flex">'
      + [5, 3].map((k) => `<div class="hand" style="width:150px">${handSvgMarkup(k)}</div>`).join('') + '</div>';
    return [...document.querySelectorAll('.hand')].map((e) => e.getBoundingClientRect().toJSON());
  });
  expect(a.right).toBeLessThanOrEqual(b.left + 1);
});
