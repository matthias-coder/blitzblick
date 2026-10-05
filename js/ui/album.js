import { h } from './dom.js';
import { iconBtn, starBadge, uiIcon } from './widgets.js';
import {
  SECRET_PAGE, stickerId, stickerUrl, isPageVisible, isPageComplete, canTrade, packPrice, countOf, openPack, pageById,
} from '../rewards.js';
import { WORLD_LABELS, pagesOf, bonusWorldVisible, albumStart, defaultPage } from '../album-nav.js';
import { stickerName } from '../sticker-names.js';
import { updateProfile } from '../profiles.js';
import { EXERCISE_ORDER } from '../exercises/index.js';
import { STICKER, DUPLICATE, BONUS_PAGE } from '../phrases.js';

const REVEAL_MS = 2500;

// a scrolling tab row fades out at an edge while more tabs are hidden there
function edgeFade(nav) {
  const update = () => {
    nav.classList.toggle('fade-start', nav.scrollLeft > 2);
    nav.classList.toggle('fade-end', nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
  };
  nav.addEventListener('scroll', update, { passive: true });
  return update;
}

export function render(root, ctx, { highlight = null, page = null } = {}) {
  const rw = () => ctx.profile.rewards;
  // the secret page stays invisible until its first sticker is collected
  const secretIds = () => SECRET_PAGE.stickers.map((s) => stickerId(SECRET_PAGE.id, s)).filter((id) => rw().stickers.includes(id));
  const visible = (pg) => pg === SECRET_PAGE || isPageVisible(rw(), pg);
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof Element.prototype.animate === 'function';
  const animations = [], timers = [];
  let { world, pageId } = albumStart(ctx.profile, { page, highlight });
  if (world === 'secret' && !secretIds().length) ({ world, pageId } = albumStart(ctx.profile));
  let justTraded = null;
  let closePack = null;
  let starBadgeEl = starBadge(rw().stars);
  const worlds = h('nav', { class: 'album-worlds', 'aria-label': 'Welten' });
  const tabs = h('nav', { class: 'album-tabs', 'aria-label': 'Seiten' });
  const body = h('div', { class: 'album-page' });
  const fadeWorlds = edgeFade(worlds);
  const fadeTabs = edgeFade(tabs);
  const onResize = () => { fadeWorlds(); fadeTabs(); };
  addEventListener('resize', onResize);

  function tradeBar(pg) {
    if (isPageComplete(rw(), pg)) return h('div', { class: 'page-complete', 'data-testid': 'page-complete' }, uiIcon('check'), 'komplett');
    // visible because of old stickers, but its level is not reached: nothing to trade yet
    if (!canTrade(rw(), pg)) return null;
    const price = packPrice(pg);
    return h('button', {
      class: 'candy pack-btn', 'data-testid': 'open-pack', disabled: rw().stars < price,
      'aria-label': `Sticker-Tüte öffnen für ${price} Sterne`, onClick: () => trade(pg),
    }, h('span', {}, 'Tüte öffnen'), h('span', { class: 'pack-price' }, String(price), uiIcon('star')));
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

  // #25: the new sticker flips in on a modal overlay; Escape, a tap or a moment closes it and the focus goes back
  function showPack(res) {
    closePack?.();
    const name = stickerName(res.sticker);
    const card = h('div', { class: 'sticker-reveal' }, h('img', { src: stickerUrl(res.sticker), alt: name }));
    const closeBtn = h('button', { type: 'button', class: 'icon-btn candy candy-round pack-close', 'data-testid': 'pack-close', 'aria-label': 'Schließen' }, uiIcon('check'));
    const overlay = h('div', {
      class: 'pack-reveal', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Neuer Sticker: ${name}`,
      'data-testid': 'pack-result', 'data-sticker': res.sticker,
    },
    card,
    res.duplicate ? h('span', { class: 'pack-count' }, `×${res.count}`) : null,
    res.unlockedBonus ? h('span', { class: 'pack-count' }, uiIcon('album'), '+30', uiIcon('star')) : null,
    closeBtn);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); } // one button: the focus stays on it
    };
    function close() {
      if (closePack !== close) return;
      closePack = null;
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      const slot = body.querySelector(`[data-testid="sticker-${res.sticker}"]`);
      slot?.classList.add('highlight');
      slot?.scrollIntoView?.({ block: 'nearest' });
      (body.querySelector('[data-testid="open-pack"]:not(:disabled)') ?? tabs.querySelector('.album-tab.active') ?? worlds.querySelector('.album-world.active'))
        ?.focus({ preventScroll: true });
    }
    closePack = close;
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    timers.push(setTimeout(close, REVEAL_MS));
    root.append(overlay);
    closeBtn.focus();
    if (motion) {
      animations.push(card.animate([
        { transform: 'rotateY(180deg) scale(.3)', opacity: 0 },
        { transform: 'rotateY(-12deg) scale(1.08)', opacity: 1, offset: 0.75 },
        { transform: 'rotateY(0) scale(1)', opacity: 1 },
      ], { duration: 700, easing: 'ease-out', fill: 'backwards' }));
    }
  }

  function chooseWorld(id) {
    world = id;
    pageId = defaultPage(ctx.profile, id).id;
    draw();
  }

  function worldChip(id, icon) {
    const on = id === world;
    return h('button', {
      type: 'button', class: `album-world candy candy-small${on ? ' active' : ''}`, 'data-testid': `album-world-${id}`,
      'aria-pressed': String(on), onClick: () => chooseWorld(id),
    }, icon, h('span', {}, WORLD_LABELS[id]));
  }

  function pageTab(pg) {
    const locked = !isPageVisible(rw(), pg);
    const on = pg.id === pageId;
    return h('button', {
      type: 'button',
      class: `album-tab candy candy-small${on ? ' active' : ''}${locked ? ' locked' : ''}`,
      'data-testid': `album-tab-${pg.id}`,
      'aria-current': on ? 'page' : null,
      'aria-label': pg.bonus ? `${pg.title}, Bonusseite` : `${pg.title}, Level ${pg.level + 1}`,
      onClick: () => { pageId = pg.id; draw(); },
    }, h('img', { src: locked ? 'assets/ui/lock.svg' : stickerUrl(stickerId(pg.id, pg.stickers[0])), alt: '' }),
    h('span', { class: 'album-tab-level medal-badge' }, pg.bonus ? uiIcon('star') : String(pg.level + 1)));
  }

  function stickerTile(pg, name) {
    const id = stickerId(pg.id, name);
    const have = rw().stickers.includes(id);
    const n = countOf(rw(), id);
    const label = !have ? `${stickerName(id)}, fehlt` : n >= 2 ? `${stickerName(id)}, ${n}-mal` : stickerName(id);
    return h('div', {
      class: `sticker${have ? ' collected' : ''}${id === highlight || id === justTraded ? ' highlight' : ''}`,
      'data-testid': `sticker-${id}`, role: 'img', 'aria-label': label,
    }, h('img', { src: stickerUrl(id), alt: '' }),
    have ? null : h('span', { class: 'sticker-missing', 'aria-hidden': 'true' }, '?'),
    n >= 2 ? h('span', { class: 'sticker-count', 'data-testid': `sticker-count-${id}` }, String(n)) : null);
  }

  function draw() {
    const secret = secretIds();
    worlds.replaceChildren(
      ...EXERCISE_ORDER.map((ex) => worldChip(ex, h('img', { src: `assets/menu/${ex}.webp`, alt: '' }))),
      (bonusWorldVisible(rw()) || world === 'bonus') ? worldChip('bonus', uiIcon('star')) : null,
      secret.length ? h('button', {
        type: 'button', class: `album-world album-secret candy candy-small${world === 'secret' ? ' active' : ''}`,
        'data-testid': `album-tab-${SECRET_PAGE.id}`, 'aria-label': SECRET_PAGE.title, 'aria-pressed': String(world === 'secret'),
        onClick: () => chooseWorld('secret'),
      }, h('img', { src: stickerUrl(secret[0]), alt: '' })) : null,
    );
    tabs.hidden = world === 'secret';
    tabs.replaceChildren(...(world === 'secret' ? [] : pagesOf(world).map(pageTab)));
    worlds.querySelector('.album-world.active')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    tabs.querySelector('.album-tab.active')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    fadeWorlds();
    fadeTabs();
    const pg = pageById(pageId);
    if (!visible(pg)) {
      body.replaceChildren(h('div', { class: 'locked-page', 'data-testid': 'locked-page' },
        uiIcon('lock'),
        h('div', { class: 'need' }, h('img', { src: `assets/menu/${pg.exercise}.webp`, alt: '' }), pg.bonus ? 'Alle vier Seiten voll' : `Level ${pg.level + 1}`)));
      ctx.speech.speak(pg.bonus ? 'Diese Bonusseite gibt es, wenn alle vier Seiten voll sind.' : `Diese Seite gibt es ab Level ${pg.level + 1}.`, { extra: true });
      return;
    }
    body.replaceChildren(h('div', { class: 'sticker-grid' }, pg.stickers.map((name) => stickerTile(pg, name))),
      pg === SECRET_PAGE ? null : h('div', { class: 'trade' }, tradeBar(pg)));
    justTraded = null;
  }

  root.append(
    h('h1', { class: 'sr-only' }, 'Sammelalbum'),
    h('header', { class: 'topbar' }, iconBtn('back', 'Zurück', () => ctx.go('menu'), 'back'), h('div', { class: 'spacer' }), starBadgeEl),
    worlds,
    tabs,
    body,
  );
  draw();
  return () => {
    closePack?.();
    removeEventListener('resize', onResize);
    timers.forEach(clearTimeout);
    animations.forEach((a) => a.cancel());
  };
}
