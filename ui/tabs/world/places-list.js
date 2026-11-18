// Builds the Places card: the places the story made up (no map position), as a plain list, the current one first.
import { h } from '../../kit/dom.js';

const meta = place => [place.kind, place.region].filter(Boolean).join(' · ');

/** The list of places without a map position; each row says where it is (kind, region) and whether the party is there or has been. */
export function placesCard(places = []) {
  const sorted = [...places].sort((a, b) => Number(b.here) - Number(a.here));
  return h('div', { class: 'wplaces', dataset: { places: 'list' } },
    h('ul', null, sorted.map(place => h('li', { dataset: { place: place.id, here: String(place.here) } },
      h('b', null, place.name),
      meta(place) ? h('small', null, ` · ${meta(place)}`) : null,
      place.here ? h('span', { class: 'st' }, ' here') : place.visited ? h('span', { class: 'st' }, ' been') : null))));
}
