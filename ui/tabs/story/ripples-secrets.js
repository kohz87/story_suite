// Builds the Secrets card (one list, with dossier links) and the Ripples card (sway bars of named powers).
import { h } from '../../kit/dom.js';
import { gatedCard } from './director.js';

/** Builds the Secrets card; a secret tied to a person links to that dossier through ctx.go. */
export function secretsCard(secrets, shown, ctx = {}) {
  return gatedCard('Secrets', secrets, shown, s => h('div', { class: 'it2' },
    h('div', { class: 'h' }, h('b', null, s.title), h('span', { class: 'tagx' }, s.state)),
    h('p', null, s.text),
    s.personId
      ? h('div', { class: 'm' }, h('a', { href: '#', dataset: { personId: s.personId }, onClick: (e) => { e.preventDefault?.(); ctx.go?.('people', { personId: s.personId }); } }, s.person ? `in ${s.person}’s dossier ›` : 'in dossier ›'))
      : null));
}

/** Builds the Ripples card: each named power with its sway as a number and a bar clamped to 0-100. */
export function ripplesCard(ripples, shown) {
  const note = h('p', { class: 'fine' }, 'Hidden sway of named powers from quests, events and fights.');
  return gatedCard('Ripples', ripples, shown, r => h('div', { class: 'rip' },
    h('span', null, r.name), h('span', null, String(r.sway)),
    h('i', null, h('b', { style: { width: `${Math.min(100, Math.max(0, Number(r.sway) || 0))}%` } }))), note);
}
