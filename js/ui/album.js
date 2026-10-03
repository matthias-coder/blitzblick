import { h } from './dom.js';
import { iconBtn, starBadge, uiIcon } from './widgets.js';
import { PAGES, STARS_PER_PAGE, stickerId, stickerUrl } from '../rewards.js';

export function render(root, ctx, { highlight = null } = {}) {
  const r = ctx.profile.rewards;
  let pageIndex = highlight ? Math.max(0, PAGES.findIndex((p) => highlight.startsWith(`${p.id}/`))) : 0;
  const tabs = h('nav', { class: 'album-tabs' });
  const body = h('div', { class: 'album-page' });

  function draw() {
    tabs.replaceChildren(...PAGES.map((pg, i) => {
      const locked = i >= r.unlockedPages;
      return h('button', {
        class: `album-tab${i === pageIndex ? ' active' : ''}${locked ? ' locked' : ''}`,
        'data-testid': `album-tab-${pg.id}`,
        'aria-label': pg.title,
        onClick: () => { pageIndex = i; draw(); },
      }, h('img', { src: locked ? 'assets/ui/lock.svg' : stickerUrl(stickerId(pg.id, pg.stickers[0])), alt: '' }));
    }));
    const pg = PAGES[pageIndex];
    if (pageIndex >= r.unlockedPages) {
      const need = pageIndex * STARS_PER_PAGE;
      body.replaceChildren(h('div', { class: 'locked-page', 'data-testid': 'locked-page' },
        uiIcon('lock'), h('div', { class: 'need' }, uiIcon('star'), String(need))));
      ctx.speech.speak(`Diese Seite gibt es ab ${need} Sternen.`);
      return;
    }
    body.replaceChildren(h('div', { class: 'sticker-grid' }, pg.stickers.map((name) => {
      const id = stickerId(pg.id, name);
      const have = r.stickers.includes(id);
      return h('div', {
        class: `sticker${have ? ' collected' : ''}${id === highlight ? ' highlight' : ''}`,
        'data-testid': `sticker-${id}`,
      }, h('img', { src: stickerUrl(id), alt: '' }));
    })));
  }

  root.append(
    h('header', { class: 'topbar' }, iconBtn('back', 'Zurück', () => ctx.go('menu'), 'back'), h('div', { class: 'spacer' }), starBadge(r.stars)),
    tabs,
    body,
  );
  draw();
}
