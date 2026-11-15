// Builds the place sheet: kind, region, danger, distance from you, news, quests and people for one map place.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { button } from '../../kit/controls.js';
import { placeGlyph } from './map.js';
import { timeWords } from './trip.js';

const DANGER_WORDS = { safe: 'Safe', risky: 'Risky', dangerous: 'Dangerous' };
const cap = text => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** Words how far a place is from you along the planned trip, or null when it is not on the trip (or is where you are). */
export function fromYou(place, world = {}) {
  if (place.here) return 'You are here';
  const legs = world.trip?.legs ?? [];
  let minutes = 0;
  let km = 0;
  for (const leg of legs) {
    minutes += Number(leg.minutes) || 0;
    km += Number(leg.km) || 0;
    if (leg.to === place.name) return `${km ? `${km} km on foot · ` : ''}${timeWords(minutes)}`;
  }
  return null;
}

function personName(world, id) {
  for (const f of world.factions ?? []) {
    const m = f.members?.find(member => member.personId === id);
    if (m) return m.name;
  }
  return cap(id);
}

/** Builds the sheet for `place`; ctx = { rpg, go(tab, args), edit(target) }; onClose() closes it. */
export function placeSheet(place, world = {}, ctx = {}, onClose = () => {}) {
  const news = (world.news ?? []).filter(n => n.placeId === place.id).map(n => n.title);
  const from = fromYou(place, world);
  const rows = [];
  const add = (label, value) => rows.push(h('dt', null, label), h('dd', null, value));
  if (from) add('From you', from);
  if (news.length) add('News', news.map((t, i) => [i ? h('br') : null, t]));
  if (place.quests?.length) add('Quests', place.quests.map((t, i) => [i ? h('br') : null, t]));
  if (place.people?.length) {
    add('People', place.people.map(id => button({
      label: personName(world, id),
      className: 'plink',
      dataset: { personId: id },
      onClick: () => ctx.go?.('people', { personId: id }),
    })));
  }
  const showDanger = ctx.rpg !== false && DANGER_WORDS[place.danger];
  return h(
    'div',
    { class: 'wov', dataset: { sheet: 'place' }, onClick: e => { if (e.target === e.currentTarget) onClose(); } },
    h('div', { class: 'wsheet', role: 'dialog', 'aria-label': place.name },
      h('span', { class: 'grab' }),
      h('div', { class: 'dh' },
        h('span', { class: 'tl' }, glyph(placeGlyph(place.kind))),
        h('div', null,
          h('div', { class: 'dn' }, place.name),
          h('div', { class: 'chips' },
            h('span', { class: 'lvl2' }, place.kind),
            place.region ? h('span', { class: 'lvl2' }, place.region) : null,
            showDanger ? h('span', { class: ['lvl2', 'dz', `dz-${place.danger}`] }, DANGER_WORDS[place.danger]) : null,
            place.visited ? null : h('span', { class: 'lvl2' }, 'not visited yet'))),
        button({ label: 'Edit', ariaLabel: `Edit ${place.name}`, className: 'ed', onClick: () => ctx.edit?.({ kind: 'place', id: place.id }) }),
        button({ tone: 'icon', label: 'Close', className: 'x', icon: h('span', null, '×'), onClick: onClose })),
      rows.length ? h('dl', { class: 'kv' }, rows) : null,
      h('p', { class: 'fine' }, 'To go there, say so in the story; code plans the route at the party pace.')),
  );
}
