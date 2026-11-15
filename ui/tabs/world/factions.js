// Builds the Factions card: each known faction with its stance, summary, area, known members and latest event.
import { h, svgEl } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';

const EMBLEMS = Object.freeze({ guild: ['guild', '#3d7be0'], chapel: ['chapel', '#c99a2e'], council: ['sail', '#2fa39a'], 'red-cord': ['cord', '#c0392b'], 'men-in-grey': ['mask', '#6b7280'] });
const FALLBACK = Object.freeze([['guild', '#3d7be0'], ['sail', '#2fa39a'], ['cord', '#c0392b'], ['mask', '#6b7280'], ['chapel', '#c99a2e']]);

/** Picks a faction's emblem glyph and colour: a known id keeps its own, others take a stable fallback from their position. */
export function emblemFor(id, index = 0) {
  return EMBLEMS[id] ?? FALLBACK[Math.abs(index) % FALLBACK.length];
}

const isGroup = name => /^the /i.test(name);

/** A head-and-shoulders mark for a group with no portrait, such as "the Harbour Master". */
const silhouette = () => svgEl('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' },
  svgEl('circle', { cx: 12, cy: 8, r: 4 }), svgEl('path', { d: 'M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7z' }));

function memberChip(m, act) {
  const inner = m.personId ? m.name.slice(0, 1) : (isGroup(m.name) ? silhouette() : m.name.slice(0, 1));
  return m.personId
    ? h('button', { type: 'button', class: 'a', title: m.name, 'aria-label': m.name, dataset: { personId: m.personId, portrait: m.personId }, onClick: () => act.openPerson(m.personId) }, inner)
    : h('span', { class: 'a', title: m.name }, inner);
}

function factionRow(f, index, news, act) {
  const [icon, colour] = emblemFor(f.id, index);
  const event = news.find(n => n.factionId === f.id);
  const members = f.members ?? [];
  return h('div', { class: 'fac', dataset: { faction: f.id } },
    h('span', { class: 'emb', style: { background: colour } }, glyph(icon)),
    h('div', null,
      h('div', { class: 'fh' },
        h('b', null, f.name),
        h('span', { class: ['stn', f.stance] }, f.stance),
        h('button', { type: 'button', class: 'btn2 ed', 'aria-label': `Edit ${f.name}`, onClick: () => act.edit({ kind: 'faction', id: f.id }) }, 'Edit')),
      h('p', null, f.summary),
      h('div', { class: 'fl' },
        (f.areaPlaceIds ?? []).map(id => act.placeName(id)
          ? h('a', { href: '#', class: 'xlink', dataset: { goto: id }, onClick: (e) => { e.preventDefault?.(); act.gotoPlace(id); } }, `📍 ${act.placeName(id)}`)
          : null),
        members.length ? h('span', { class: 'avs' }, members.map(m => memberChip(m, act))) : null,
        members.length ? h('span', null, members.map(m => m.name).join(', ')) : null,
        event ? h('a', { href: '#', class: 'xlink', dataset: { wf: 'news' }, onClick: (e) => { e.preventDefault?.(); act.setView('news'); } }, `✦ ${event.title}`) : null)));
}

/** Builds the Factions card; act = { placeName, gotoPlace, setView, openPerson, edit }. Null when no faction is known. */
export function factionsCard(factions, news, act) {
  const list = Array.isArray(factions) ? factions : [];
  if (!list.length) return null;
  const events = Array.isArray(news) ? news : [];
  return h('section', { class: 'card glass', dataset: { card: 'factions' } },
    h('div', { class: 'ch' }, h('h3', null, 'Factions'), h('span', { class: 'cnt' }, `${list.length} known`)),
    h('div', null, list.map((f, i) => factionRow(f, i, events, act))));
}
