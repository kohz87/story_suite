// Builds the Conditions here card: the world's conditions in force at the party's place, with since when, why and what they do to prices.
import { h } from '../../kit/dom.js';

// A pack's condition name has no display form of its own: its dashes and underscores read as spaces.
const words = name => String(name ?? '').replace(/[-_]+/g, ' ');

function row(c) {
  return h('div', { class: 'ev', dataset: { condition: c.key || c.name } },
    h('div', { class: 'eh' }, h('b', null, words(c.name)), c.ref ? h('span', { class: 'st' }, c.ref) : null),
    c.means ? h('p', null, c.means) : null,
    h('div', { class: 'meta2' },
      c.since ? h('span', null, `since ${c.since}`) : null,
      c.why ? h('span', null, `because ${c.why}`) : null,
      c.told ? h('span', null, `prices and roads: ${c.told}`) : null));
}

/** Builds the card from the view-model's `conditions` ({ place, rows }); null when the switch is off (no `conditions`) or nothing holds here. */
export function conditionsCard(conditions) {
  const rows = Array.isArray(conditions?.rows) ? conditions.rows : [];
  if (!rows.length) return null;
  return h('section', { class: 'card glass', dataset: { card: 'conditions' } },
    h('div', { class: 'ch' }, h('h3', null, 'Conditions here'), h('span', { class: 'cnt' }, conditions.place || 'where you are')),
    h('div', { class: 'evlist' }, rows.map(row)));
}
