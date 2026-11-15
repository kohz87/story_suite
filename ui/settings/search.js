// Finds settings rows by words across label, hint, unit, group and section name, and renders the hits under "Section › Group".
import { h } from '../kit/dom.js';
import { renderRow } from './fields.js';

/** Returns `[{ section, row }]` for every row whose text contains all words of `query` (case-insensitive); blank query gives none. */
export function searchRows(sections, query) {
  const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits = [];
  for (const section of sections ?? []) {
    for (const row of section.rows ?? []) {
      const hay = [row.label, row.hint, row.unit, row.group, section.name].filter(Boolean).join(' ').toLowerCase();
      if (words.every(w => hay.includes(w))) hits.push({ section, row });
    }
  }
  return hits;
}

/** Builds the search page: a count line, then each hit as a card titled with its section and group; ctx goes to `renderRow`. */
export function renderSearchResults(hits, query, ctx = {}) {
  const n = hits.length;
  return h(
    'div',
    { class: 'sresults' },
    h('div', h('h2', 'Search'), h('p', { class: 'sdesc' }, `${n} setting${n === 1 ? '' : 's'} for “${String(query ?? '').trim()}”`)),
    n === 0
      ? h('p', { class: 'fine' }, 'Nothing found.')
      : hits.map(({ section, row }) => h(
        'div',
        { class: 'sgrp', dataset: { section: section.id } },
        h('div', { class: 'gt' }, `${section.name} › ${row.group}`),
        renderRow(row, ctx),
      )),
  );
}
