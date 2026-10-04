import { h } from './dom.js';
import { iconBtn, starBadge, uiIcon } from './widgets.js';
import { PAGES, SECRET_PAGE, stickerId, stickerUrl, isPageVisible } from '../rewards.js';
import { EXERCISE_ORDER } from '../exercises/index.js';

export function render(root, ctx, { highlight = null } = {}) {
  const r = ctx.profile.rewards;
  // the secret page stays invisible until its first sticker is collected
  const secretIds = SECRET_PAGE.stickers.map((s) => stickerId(SECRET_PAGE.id, s)).filter((id) => r.stickers.includes(id));
  const pages = secretIds.length ? [...PAGES, SECRET_PAGE] : PAGES;
  const visible = (pg) => pg === SECRET_PAGE || isPageVisible(r, pg);
  let pageIndex = highlight ? Math.max(0, pages.findIndex((p) => highlight.startsWith(`${p.id}/`))) : 0;
  const tabs = h('nav', { class: 'album-tabs' });
  const body = h('div', { class: 'album-page' });

  function draw() {
    // one group per exercise (menu picture first), then its four level pages; the secret page last, once found
    tabs.replaceChildren(...EXERCISE_ORDER.map((ex) => h('div', { class: 'album-group', 'data-testid': `album-group-${ex}` },
      h('img', { class: 'album-group-icon', src: `assets/menu/${ex}.webp`, alt: '' }),
      PAGES.map((pg, i) => [pg, i]).filter(([pg]) => pg.exercise === ex).map(([pg, i]) => {
        const locked = !isPageVisible(r, pg);
        return h('button', {
          class: `album-tab candy candy-small${i === pageIndex ? ' active' : ''}${locked ? ' locked' : ''}`,
          'data-testid': `album-tab-${pg.id}`,
          'aria-label': `${pg.title}, Level ${pg.level + 1}`,
          onClick: () => { pageIndex = i; draw(); },
        }, h('img', { src: locked ? 'assets/ui/lock.svg' : stickerUrl(stickerId(pg.id, pg.stickers[0])), alt: '' }),
        h('span', { class: 'album-tab-level medal-badge' }, String(pg.level + 1)));
      }))),
    ...(secretIds.length ? [h('div', { class: 'album-group', 'data-testid': 'album-group-secret' },
      h('button', {
        class: `album-tab candy candy-small${pageIndex === PAGES.length ? ' active' : ''}`,
        'data-testid': `album-tab-${SECRET_PAGE.id}`,
        'aria-label': SECRET_PAGE.title,
        onClick: () => { pageIndex = PAGES.length; draw(); },
      }, h('img', { src: stickerUrl(secretIds[0]), alt: '' })))] : []));
    tabs.querySelector('.album-tab.active')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    const pg = pages[pageIndex];
    if (!visible(pg)) {
      body.replaceChildren(h('div', { class: 'locked-page', 'data-testid': 'locked-page' },
        uiIcon('lock'),
        h('div', { class: 'need' }, h('img', { src: `assets/menu/${pg.exercise}.webp`, alt: '' }), `Level ${pg.level + 1}`)));
      ctx.speech.speak(`Diese Seite gibt es ab Level ${pg.level + 1}.`, { extra: true });
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
