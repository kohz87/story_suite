// Builds the "Prices here" sheet body: the going rates for this place, one row each, and the note on how they are worked out.
import { h } from '../../kit/dom.js';

/** Builds the Prices here sheet body from bag.purse.rates ({ place, rows: [{ name, price }], note }). */
export function ratesSheet(rates) {
  return h(
    'div',
    { class: 'bag-sheet', dataset: { sheet: 'rates' } },
    h('div', { class: 'last' }, rates.place),
    h('div', { class: 'rates' }, rates.rows.map(r => h('div', { class: 'rt' }, h('span', null, r.name), h('span', null, r.price)))),
    h('p', { class: 'fine' }, rates.note),
  );
}
