// Builds the 8-tab host: tablet strip, phone bottom bar, scrolling panel and the mini bar shown after the card scrolls away.

import { h } from '../kit/dom.js';
import { glyph } from '../kit/glyphs.js';

const TAB_ORDER = ['now', 'party', 'bag', 'people', 'world', 'journal', 'story', 'fight'];
const LABELS = {
  now: 'Now', party: 'Party', bag: 'Bag', people: 'People',
  world: 'World', journal: 'Journal', story: 'Story', fight: 'Fight',
};

/** Returns the tab ids to show: Party only when the RPG is on, Fight only during a fight. */
export function visibleTabs({ rpg = true, fightOpen = false } = {}) {
  return TAB_ORDER.filter((id) => (id !== 'party' || rpg) && (id !== 'fight' || fightOpen));
}

/**
 * Creates the tab host. Options: `doc`, `flags` ({ rpg, fightOpen }), `initial`, `onSelect(id)`,
 * `onChat()`, `onSettings()`. Returns `el` plus the `scroll`, `cardSlot` and `panel` elements to fill.
 */
export function createTabHost(options = {}) {
  const { flags: startFlags = {}, initial = 'now', onSelect = null, onChat = null, onSettings = null } = options;
  let flags = { rpg: true, fightOpen: false, ...startFlags };
  let current = initial;

  const strip = h('nav', { class: 'su-strip', role: 'tablist', 'aria-label': 'Story Suite tabs' });
  const bar = h('nav', { class: 'su-bar su-glass', 'aria-label': 'Story Suite tabs' });
  const cardSlot = h('div', { class: 'su-card-slot' });
  const panel = h('div', { class: 'su-panel', role: 'tabpanel', 'data-tab': current });
  const scroll = h('div', { class: 'su-scroll' }, cardSlot, strip, panel);
  const mini = h(
    'div',
    { class: 'su-mini', role: 'toolbar', 'aria-label': 'Shortcuts' },
    h('button', { type: 'button', class: 'su-mini-btn', 'data-act': 'chat', onClick: () => onChat?.() }, '‹ Chat'),
    h('button', {
      type: 'button', class: 'su-mini-btn', 'data-act': 'settings', 'aria-label': 'Settings', onClick: () => onSettings?.(),
    }, '⚙'),
  );
  const el = h('div', { class: 'su-host' }, mini, scroll, bar);

  function updateMini() {
    const limit = cardSlot.offsetTop + cardSlot.offsetHeight;
    mini.classList.toggle('on', current !== 'fight' && scroll.scrollTop > limit);
  }

  function pick(id) {
    if (!visibleTabs(flags).includes(id)) return false;
    const changed = id !== current;
    current = id;
    panel.setAttribute('data-tab', id);
    scroll.scrollTop = 0;
    render();
    if (changed && typeof onSelect === 'function') onSelect(id);
    return true;
  }

  function move(from, key) {
    const ids = visibleTabs(flags);
    const i = ids.indexOf(from);
    if (key === 'Home') return ids[0];
    if (key === 'End') return ids[ids.length - 1];
    const step = key === 'ArrowRight' ? 1 : -1;
    return ids[(i + step + ids.length) % ids.length];
  }

  function render() {
    if (!visibleTabs(flags).includes(current)) {
      current = 'now';
      panel.setAttribute('data-tab', current);
    }
    const ids = visibleTabs(flags);
    strip.replaceChildren(...ids.map((id) => h('button', {
      type: 'button',
      role: 'tab',
      class: 'su-tab',
      'aria-selected': String(id === current),
      tabindex: id === current ? '0' : '-1',
      'data-tab': id,
      onClick: () => pick(id),
      onKeydown: (event) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault?.();
        const next = move(id, event.key);
        pick(next);
        strip.querySelector(`[data-tab="${next}"]`)?.focus();
      },
    }, glyph(id), LABELS[id])));
    bar.replaceChildren(...ids.map((id) => h('button', {
      type: 'button',
      class: 'su-bar-btn',
      'aria-current': String(id === current),
      'data-tab': id,
      onClick: () => pick(id),
    }, glyph(id), h('span', { class: 'su-bar-label' }, LABELS[id]), h('span', { class: 'su-bar-dot' }))));
    updateMini();
  }

  scroll.addEventListener('scroll', updateMini);
  render();

  return {
    el,
    scroll,
    cardSlot,
    panel,
    select: pick,
    current: () => current,
    tabs: () => visibleTabs(flags),
    setFlags(next) {
      flags = { ...flags, ...next };
      render();
      return visibleTabs(flags);
    },
  };
}
