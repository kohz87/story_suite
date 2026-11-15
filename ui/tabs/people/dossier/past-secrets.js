// Builds the Ties, Past and Secrets pages of a dossier (opened secrets stay readable after a death; locked ones show only their rule).
import { h } from '../../../kit/dom.js';
import { glyph } from '../../../kit/glyphs.js';
import { button } from '../../../kit/controls.js';
import { pageSection } from '../../../kit/page.js';

/** First letter of a tie's name, upper case, without a leading "the" ("the Harbour Master" gives H). */
export function tieInitial(tie) {
  return String(tie?.name ?? '?').replace(/^the /i, '').slice(0, 1).toUpperCase();
}

/** Builds the Ties page: one row per known tie; a tie with a person id opens that dossier through ctx.go. */
export function tiesPage(d, ctx = {}) {
  const ties = d.ties ?? [];
  if (!ties.length) return h('p', { class: 'fine' }, 'No ties known.');
  return h('div', { class: 'ties' }, ties.map((t) => {
    const body = [h('span', { class: 'a' }, tieInitial(t)), h('span', { class: 'tt' }, h('b', null, t.name), h('small', null, t.line))];
    return t.personId
      ? h('button', { type: 'button', class: 'tie', dataset: { personId: t.personId }, onClick: () => ctx.go?.('people', { personId: t.personId }) }, body)
      : h('div', { class: 'tie' }, body);
  }));
}

/** Builds the Past page: dated memories newest first (a Day › link only when the memory has a day), and + Add a memory. */
export function pastPage(d, ctx = {}) {
  const past = d.past ?? [];
  return [
    past.length
      ? h('div', { class: 'tl2' }, past.map(m => h('div', { class: 'e' }, h('span', null, m.date),
        h('span', null, m.text, m.dayRef ? h('button', { type: 'button', class: 'lnk2 day', dataset: { day: m.dayRef }, onClick: () => ctx.go?.('journal', { day: m.dayRef }) }, 'Day ›') : null))))
      : h('p', { class: 'fine' }, 'No memories yet.'),
    button({ label: '+ Add a memory', className: 'add', onClick: () => ctx.port?.command?.('npc.memory.add', { personId: d.id }) }),
  ];
}

function secretRow(s) {
  return h('div', { class: ['sec', s.open ? 'open' : null], dataset: { open: String(Boolean(s.open)) } },
    h('span', { class: 'ic' }, glyph(s.open ? 'info' : 'key')),
    h('span', { class: 'tt' }, h('b', null, s.open ? (s.title ?? 'A secret') : 'A secret'), h('small', null, s.rule ?? ''),
      s.open && s.text ? h('span', { class: 'lc sm' }, s.text) : null));
}

/** Builds the Secrets page: opened and hidden counts, then each secret (a locked one shows only the rule that opens it). */
export function secretsPage(d) {
  const { opened = 0, total = 0, items = [] } = d.secrets ?? {};
  return [
    h('p', { class: 'fine' }, `${opened} opened · ${Math.max(0, total - opened)} still hidden. The narrator knows them all and keeps them; each appears here when it opens, and an opened one stays readable after a death. Locked ones show only the rule that opens them.`),
    pageSection(null, items.map(secretRow)),
  ].filter(Boolean);
}
