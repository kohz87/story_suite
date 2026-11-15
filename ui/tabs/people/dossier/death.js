// Builds the Death page and card for a deceased or presumed-dead person: how, when, where, certainty, Mark alive and the reference line.
import { h } from '../../../kit/dom.js';
import { button } from '../../../kit/controls.js';
import { kvList, pageSection } from '../../../kit/page.js';

const CERTAINTY = Object.freeze({ confirmed: 'Confirmed', presumed: 'Presumed' });

/** Builds the Death card body (how, when and where, certainty); null when the person has no death record. */
export function deathCard(d) {
  const x = d.death;
  if (!x) return null;
  return [
    h('span', { class: 'lc' }, h('b', null, x.how)),
    h('span', { class: 'lc sm' }, [x.when, x.where].filter(Boolean).join(' · ')),
    h('span', { class: ['hint', x.certainty === 'presumed' ? 'pres' : 'ok'] }, `${x.certainty === 'presumed' ? '?' : '✓'} ${CERTAINTY[x.certainty] ?? x.certainty}`),
  ];
}

/** Builds the Death page; Mark alive sends `npc.markAlive` with the person id. The reference line is the exact text the narrator gets. */
export function deathPage(d, ctx = {}) {
  const x = d.death;
  if (!x) return h('p', { class: 'fine' }, 'No death is recorded.');
  return [
    kvList([['How', x.how], ['When', [x.when, h('small', null, ' (the reply that recorded it)')]], ['Where', x.where ? [x.where, h('small', null, ' (where they were)')] : null], ['Certainty', CERTAINTY[x.certainty] ?? x.certainty]]),
    h('div', { class: 'brow' }, button({ label: 'Not dead? Mark alive', dataset: { act: 'mark-alive' }, onClick: () => ctx.port?.command?.('npc.markAlive', { personId: d.id }) })),
    pageSection(`When the story mentions ${d.name}`,
      h('p', { class: 'remline' }, x.referenceLine),
      h('p', { class: 'fine' }, 'The exact line the narrator gets whenever the name or an alias comes up. Gender is frozen at death; only you can change it, in Edit. The dead get their own reference lines, so living people mentioned in the same scene never push them out.')),
  ].filter(Boolean);
}
