// Builds the Items card: find box, filter chips and the grid of item tiles (rarity, quantity, wearer, new and torn marks).
import { h, svgEl } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { button } from '../../kit/controls.js';

export const KIND_LABEL = Object.freeze({ gear: 'Gear', use: 'Use', goods: 'Goods', material: 'Materials', quest: 'Quest' });
const FILTER_LABEL = Object.freeze({ all: 'In bag', worn: 'Worn', ...KIND_LABEL });
const RARITY_CLASS = Object.freeze({ uncommon: 'r-unc', rare: 'r-rare', epic: 'r-epic' });

/** Returns a member's display name from ctx.members ({ id: name }), falling back to the capitalised id. */
export function memberName(id, ctx = {}) {
  if (!id) return '';
  return ctx.members?.[id] ?? `${id[0].toUpperCase()}${id.slice(1)}`;
}

const QUEST_PAGE = 'M6 3h12a2 2 0 0 1 2 2v3h-3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z';

/** The mock's item glyph set draws a quest page with three text lines; the kit's plain page is used for every other name. */
function tileGlyph(name) {
  if (name !== 'quest') return glyph(name) ?? glyph('item');
  return svgEl('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' },
    svgEl('path', { d: QUEST_PAGE }),
    svgEl('path', { d: 'M7.5 9h6M7.5 12.5h6M7.5 16h4', fill: 'none', stroke: 'var(--su-panel2)', 'stroke-width': 1.6 }));
}

/** Builds one item tile; rarity colours, wear and weight marks show only when `rpg` is true. */
export function itemTile(item, rpg, size = '') {
  const rarity = rpg ? RARITY_CLASS[item.rarity] : null;
  return h(
    'span',
    { class: ['tl', rarity, size], dataset: { glyph: item.glyph } },
    tileGlyph(item.glyph),
    item.qty > 1 ? h('span', { class: 'q' }, `×${item.qty}`) : null,
    item.wornBy ? h('span', { class: 'av wr', dataset: { portrait: item.wornBy } }) : null,
    item.isNew ? h('span', { class: 'nw', title: 'New this turn' }) : null,
    rpg && item.wear === 'torn' ? h('span', { class: 'wear', title: 'Torn' }, glyph('crack')) : null,
  );
}

function shown(items, key, query) {
  if (query) return items.filter(it => it.name.toLowerCase().includes(query));
  if (key === 'worn') return items.filter(it => it.wornBy);
  return items.filter(it => !it.wornBy && (key === 'all' || it.kind === key));
}

/** Builds the Items card from the bag view-model; ctx = { members, onItem(item) }. Null when there are no items. */
export function itemsCard(bag, ctx = {}) {
  const items = Array.isArray(bag?.items) ? bag.items : [];
  if (!items.length) return null;
  const rpg = Boolean(bag.rpg);
  const filters = (bag.filters ?? []).filter(f => f.key in FILTER_LABEL);
  let key = 'all';
  let query = '';
  const search = h('input', { class: 'srch', placeholder: 'Find an item', 'aria-label': 'Find an item', hidden: true });
  const chips = h('div', { class: 'fil', role: 'group', 'aria-label': 'Filter items' });
  const grid = h('div', { class: ['igrid', rpg ? null : 'norpg'] });

  function draw() {
    chips.replaceChildren(...filters.map(f => h(
      'button',
      {
        type: 'button',
        'aria-pressed': String(f.key === key && !query),
        dataset: { f: f.key },
        onClick: () => { key = f.key; query = ''; search.value = ''; draw(); },
      },
      FILTER_LABEL[f.key], h('small', null, f.count),
    )));
    const list = shown(items, key, query);
    grid.replaceChildren(...(list.length ? list.map(it => h(
      'button',
      { type: 'button', class: 'itm', dataset: { stack: it.stack }, onClick: () => ctx.onItem?.(it) },
      itemTile(it, rpg),
      h('span', { class: 'n' }, it.name),
      h('span', { class: 'k' }, it.wornBy ? memberName(it.wornBy, ctx) : KIND_LABEL[it.kind]),
    )) : [h('p', { class: 'fine' }, 'Nothing here.')]));
  }

  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); draw(); });
  const findBtn = button({
    tone: 'icon', label: 'Find an item', icon: 'search', className: 'sm',
    onClick: () => { if (search.hasAttribute('hidden')) search.removeAttribute('hidden'); else search.setAttribute('hidden', ''); },
  });
  draw();
  return h(
    'section',
    { class: 'card glass bag-items', dataset: { card: 'items' } },
    h('div', { class: 'ihead' }, h('h3', null, 'Items'), findBtn, button({ label: '+ Add', onClick: () => ctx.onAdd?.() })),
    search, chips, grid,
  );
}
