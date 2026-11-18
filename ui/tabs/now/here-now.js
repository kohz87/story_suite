// Builds Here now, the desktop left column's list of people present: the drawer's light rows (decision 9) under the character card on every tab; a row opens the person's dossier.
import { h } from '../../kit/dom.js';
import { feelingsRing } from '../../kit/ring.js';
import { isSafePortraitUrl } from '../../kit/safe-url.js';

const FOOT = 'Tap someone for what they are doing, wearing and want.';

function portrait(person) {
  const src = person.portrait;
  const style = isSafePortraitUrl(src) ? { 'background-image': `url("${src}")` } : null;
  return h('span', { class: 'ph', style, dataset: { portrait: src ?? null } }, style ? null : String(person.name ?? '?').slice(0, 1));
}

function row(person, ctx) {
  const open = () => ctx.go?.('people', { personId: person.personId });
  return h(
    'div',
    {
      class: 'hp2', role: 'button', tabindex: '0', dataset: { personId: person.personId },
      'aria-label': `${person.name}${person.mood ? `, ${person.mood}` : ''}. Open dossier`,
      onClick: open,
      onKeydown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault?.(); open(); } },
    },
    h('span', { class: 'prg' },
      feelingsRing(person.meters),
      portrait(person),
      person.followed ? h('span', { class: 'star', title: 'Followed' }, '★') : null),
    h('div', { class: 'hp2-body' },
      h('div', { class: 'nl' },
        h('b', null, person.name),
        person.mood ? h('span', { class: 'md2' }, person.mood) : null,
        h('span', { class: 'dossier-link', title: 'Dossier: doing, wearing, wants', 'aria-hidden': 'true' }, '›')),
      person.where ? h('div', { class: 'wh2' }, person.where) : null,
      person.thought ? h('div', { class: 'th3' }, `“${person.thought}”`) : null),
  );
}

/** Builds the Here now card from the Now view-model's `here` rows ({ personId, name, portrait, meters, mood, where, thought, followed }); null when nobody is present. ctx = { go(tab, args) }. */
export function hereNowCard(here, ctx = {}) {
  const people = Array.isArray(here) ? here.filter(p => p && p.name) : [];
  if (!people.length) return null;
  return h(
    'section',
    { class: 'card glass su-herenow', dataset: { card: 'here-now' } },
    h('div', { class: 'ch' }, h('h3', null, 'Here now'), h('span', { class: 'cnt' }, `${people.length} ${people.length === 1 ? 'person' : 'people'}`)),
    h('div', { class: 'here2' }, people.map(p => row(p, ctx))),
    h('small', { class: 'foot' }, FOOT),
  );
}
