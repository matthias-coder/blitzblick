import { h } from './dom.js';
import { iconBtn, starBadge, uiIcon } from './widgets.js';
import {
  ALL_PAGES, SECRET_PAGE, stickerId, stickerUrl, isPageVisible, isPageComplete, canTrade, packPrice, countOf, openPack,
} from '../rewards.js';
import { updateProfile } from '../profiles.js';
import { EXERCISE_ORDER } from '../exercises/index.js';
import { STICKER, DUPLICATE, BONUS_PAGE } from '../phrases.js';

const REVEAL_MS = 2500;

export function render(root, ctx, { highlight = null, page = null } = {}) {
  const rw = () => ctx.profile.rewards;
  // the secret page stays invisible until its first sticker is collected
  const secretIds = () => SECRET_PAGE.stickers.map((s) => stickerId(SECRET_PAGE.id, s)).filter((id) => rw().stickers.includes(id));
  const pages = () => (secretIds().length ? [...ALL_PAGES, SECRET_PAGE] : ALL_PAGES);
  const visible = (pg) => pg === SECRET_PAGE || isPageVisible(rw(), pg);
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof Element.prototype.animate === 'function';
  const animations = [], timers = [];
  let pageIndex = 0;
  if (page) pageIndex = Math.max(0, ALL_PAGES.findIndex((p) => p.id === page));
  else if (highlight) pageIndex = Math.max(0, pages().findIndex((p) => highlight.startsWith(`${p.id}/`)));
  let justTraded = null;
  let starBadgeEl = starBadge(rw().stars);
  const tabs = h('nav', { class: 'album-tabs' });
  const body = h('div', { class: 'album-page' });

  function tradeBar(pg) {
    if (isPageComplete(rw(), pg)) return h('div', { class: 'page-complete', 'data-testid': 'page-complete' }, uiIcon('check'), 'komplett');
    // visible because of old stickers, but its level is not reached: nothing to trade yet
    if (!canTrade(rw(), pg)) return null;
    const price = packPrice(pg);
    return h('button', {
      class: 'candy pack-btn', 'data-testid': 'open-pack', disabled: rw().stars < price,
      'aria-label': `Sticker-Tüte öffnen für ${price} Sterne`, onClick: () => trade(pg),
    }, h('span', {}, 'Tüte öffnen ·'), h('span', {}, String(price)), uiIcon('star'));
  }

  function trade(pg) {
    const res = openPack(rw(), pg.id, Math.random);
    if (!res) return;
    ctx.setState(updateProfile(ctx.state, ctx.profile.id, (p) => ({ ...p, rewards: res.rewards })));
    ctx.sounds.fanfare();
    ctx.speech.speak(res.unlockedBonus ? BONUS_PAGE : ctx.pick(res.duplicate ? 'duplicate' : 'sticker', res.duplicate ? DUPLICATE : STICKER));
    justTraded = res.sticker;
    starBadgeEl.replaceWith(starBadgeEl = starBadge(rw().stars));
    draw();
    showPack(res);
  }

  // the new sticker flips in on a dimmed overlay; closes on tap or after a moment and marks the slot
  function showPack(res) {
    const card = h('div', { class: 'sticker-reveal' }, h('img', { src: stickerUrl(res.sticker), alt: '' }));
    const overlay = h('div', { class: 'pack-reveal', 'data-testid': 'pack-result', 'data-sticker': res.sticker },
      card,
      res.duplicate ? h('span', { class: 'pack-count' }, `×${res.count}`) : null,
      res.unlockedBonus ? h('span', { class: 'pack-count' }, uiIcon('album'), '+30', uiIcon('star')) : null);
    const close = () => {
      overlay.remove();
      const slot = body.querySelector(`[data-testid="sticker-${res.sticker}"]`);
      slot?.classList.add('highlight');
      slot?.scrollIntoView?.({ block: 'nearest' });
    };
    overlay.addEventListener('click', close);
    timers.push(setTimeout(close, REVEAL_MS));
    root.append(overlay);
    if (motion) {
      animations.push(card.animate([
        { transform: 'rotateY(180deg) scale(.3)', opacity: 0 },
        { transform: 'rotateY(-12deg) scale(1.08)', opacity: 1, offset: 0.75 },
        { transform: 'rotateY(0) scale(1)', opacity: 1 },
      ], { duration: 700, easing: 'ease-out', fill: 'backwards' }));
    }
  }

  function draw() {
    const secret = secretIds();
    const all = pages();
    // one group per exercise (menu picture first), then its four level pages and the bonus page; the secret page last, once found
    tabs.replaceChildren(...EXERCISE_ORDER.map((ex) => h('div', { class: 'album-group', 'data-testid': `album-group-${ex}` },
      h('img', { class: 'album-group-icon', src: `assets/menu/${ex}.webp`, alt: '' }),
      ALL_PAGES.map((pg, i) => [pg, i]).filter(([pg]) => pg.exercise === ex).map(([pg, i]) => {
        const locked = !isPageVisible(rw(), pg);
        return h('button', {
          class: `album-tab candy candy-small${i === pageIndex ? ' active' : ''}${locked ? ' locked' : ''}`,
          'data-testid': `album-tab-${pg.id}`,
          'aria-label': pg.bonus ? `${pg.title}, Bonusseite` : `${pg.title}, Level ${pg.level + 1}`,
          onClick: () => { pageIndex = i; draw(); },
        }, h('img', { src: locked ? 'assets/ui/lock.svg' : stickerUrl(stickerId(pg.id, pg.stickers[0])), alt: '' }),
        h('span', { class: 'album-tab-level medal-badge' }, pg.bonus ? uiIcon('star') : String(pg.level + 1)));
      }))),
    ...(secret.length ? [h('div', { class: 'album-group', 'data-testid': 'album-group-secret' },
      h('button', {
        class: `album-tab candy candy-small${pageIndex === ALL_PAGES.length ? ' active' : ''}`,
        'data-testid': `album-tab-${SECRET_PAGE.id}`,
        'aria-label': SECRET_PAGE.title,
        onClick: () => { pageIndex = ALL_PAGES.length; draw(); },
      }, h('img', { src: stickerUrl(secret[0]), alt: '' })))] : []));
    tabs.querySelector('.album-tab.active')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    const pg = all[pageIndex];
    if (!visible(pg)) {
      body.replaceChildren(h('div', { class: 'locked-page', 'data-testid': 'locked-page' },
        uiIcon('lock'),
        h('div', { class: 'need' }, h('img', { src: `assets/menu/${pg.exercise}.webp`, alt: '' }), pg.bonus ? 'Alle vier Seiten voll' : `Level ${pg.level + 1}`)));
      ctx.speech.speak(pg.bonus ? 'Diese Bonusseite gibt es, wenn alle vier Seiten voll sind.' : `Diese Seite gibt es ab Level ${pg.level + 1}.`, { extra: true });
      return;
    }
    body.replaceChildren(h('div', { class: 'sticker-grid' }, pg.stickers.map((name) => {
      const id = stickerId(pg.id, name);
      const have = rw().stickers.includes(id);
      const n = countOf(rw(), id);
      return h('div', {
        class: `sticker${have ? ' collected' : ''}${id === highlight || id === justTraded ? ' highlight' : ''}`,
        'data-testid': `sticker-${id}`,
      }, h('img', { src: stickerUrl(id), alt: '' }),
      n >= 2 ? h('span', { class: 'sticker-count', 'data-testid': `sticker-count-${id}` }, String(n)) : null);
    })), pg === SECRET_PAGE ? null : h('div', { class: 'trade' }, tradeBar(pg)));
    justTraded = null;
  }

  root.append(
    h('header', { class: 'topbar' }, iconBtn('back', 'Zurück', () => ctx.go('menu'), 'back'), h('div', { class: 'spacer' }), starBadgeEl),
    tabs,
    body,
  );
  draw();
  return () => { timers.forEach(clearTimeout); animations.forEach((a) => a.cancel()); };
}
