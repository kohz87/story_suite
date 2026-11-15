// Builds the section navigation: a side list with search and group labels, and the phone section list with the same search.
import { h } from '../kit/dom.js';

const GROUPS = ['Play', 'Rules', 'Setup', 'Tools'];
const ICONS = {
  start: '◎', look: '◐', people: '♥', rpg: '⚔', world: '◍', director: '✎',
  money: '◉', extras: '✦', models: '⚡', packs: '▣', addons: '✚', tools: '⚙',
};

function searchBox(onQuery) {
  const el = h('input', { type: 'search', class: 'psrch', placeholder: 'Search settings…', 'aria-label': 'Search settings' });
  el.addEventListener('input', () => onQuery(el.value));
  return el;
}

function grouped(sections) {
  return GROUPS.map(name => [name, sections.filter(s => s.group === name)]).filter(([, list]) => list.length > 0);
}

/**
 * Creates the navigation for `sections`. `onPick(id, via)` fires with via 'side' or 'list'; `onQuery(text)` on typing.
 * Returns `{ side, list, setCurrent(id|null), setQuery(text) }`: `side` is the tablet column, `list` the phone list.
 */
export function createNav(sections = [], { onPick = () => {}, onQuery = () => {} } = {}) {
  const sideSearch = searchBox(onQuery);
  const listSearch = searchBox(onQuery);
  const sideButtons = new Map();
  const side = h('nav', { class: 'snav', 'aria-label': 'Settings sections' }, sideSearch);
  const list = h('div', { class: 'phonelist' }, listSearch);

  for (const [name, items] of grouped(sections)) {
    side.appendChild(h('div', { class: 'grpl' }, name));
    list.appendChild(h('div', { class: 'secl2' }, name));
    const rows = h('div', { class: 'slist' });
    for (const s of items) {
      const icon = ICONS[s.id] ?? '•';
      const btn = h('button', { type: 'button', class: 'si3', dataset: { sec: s.id }, onClick: () => onPick(s.id, 'side') },
        h('i', { 'aria-hidden': 'true' }, icon), s.name);
      sideButtons.set(s.id, btn);
      side.appendChild(btn);
      rows.appendChild(h('button', { type: 'button', dataset: { sec: s.id }, onClick: () => onPick(s.id, 'list') },
        h('i', { 'aria-hidden': 'true' }, icon), h('span', h('b', s.name), h('small', s.desc)), h('span', '›')));
    }
    list.appendChild(rows);
  }

  return {
    side,
    list,
    setCurrent(id) {
      for (const [sid, btn] of sideButtons) btn.setAttribute('aria-current', String(sid === id));
    },
    setQuery(text) {
      const q = String(text ?? '');
      for (const box of [sideSearch, listSearch]) if (box.value !== q) box.value = q;
    },
  };
}
