// Builds the News card: events the character has heard, with a state filter, heard-where-and-from lines and place and faction links.
import { h } from '../../kit/dom.js';
import { chip, button } from '../../kit/controls.js';

const FILTERS = Object.freeze([['all', 'All'], ['looming', 'Looming'], ['ongoing', 'Ongoing'], ['rumour', 'Rumours'], ['resolved', 'Resolved']]);

/** Words when and from whom an event was last heard, e.g. "last news: heard in Bluewatch, this morning · from Oyla". */
export function heardLine(heard = []) {
  if (!heard.length) return '';
  const last = heard[heard.length - 1];
  return `${heard.length > 1 ? 'last news: ' : ''}heard ${last.where}, ${last.when} · ${last.from ? `from ${last.from}` : 'you were there'}`;
}

function link(text, onClick, extra) {
  return h('a', { href: '#', class: 'xlink', ...extra, onClick: (e) => { e.preventDefault?.(); onClick(); } }, text);
}

function eventRow(n, act) {
  const place = n.placeId ? act.placeName(n.placeId) : null;
  const faction = n.factionId ? act.factionName(n.factionId) : null;
  return h('div', { class: 'ev', dataset: { event: n.id, state: n.state } },
    h('div', { class: 'eh' },
      h('b', null, n.title),
      h('span', { class: ['st', n.state] }, n.state),
      button({ label: 'Edit', ariaLabel: `Edit ${n.title}`, className: 'ed', onClick: () => act.edit({ kind: 'news', id: n.id }) })),
    h('p', null, n.summary),
    h('div', { class: 'meta2' },
      place ? link(`📍 ${place}`, () => act.gotoPlace(n.placeId), { dataset: { goto: n.placeId } }) : null,
      faction ? link(`⚑ ${faction}`, () => act.setView('factions'), { dataset: { wf: 'factions' } }) : null,
      h('span', null, heardLine(n.heard)),
      n.heard.length > 1 ? h('span', null, `first heard ${n.heard[0].when}`) : null));
}

/** Builds the News card (the Director note under it is drawn by the tab); state.filter holds the chosen filter; act = { placeName, factionName, gotoPlace, setView, edit }. Null when there is no news. */
export function newsCard(news, state, act) {
  const items = Array.isArray(news) ? news : [];
  if (!items.length) return null;
  const list = h('div', { class: 'evlist' });
  const bar = h('div', { class: 'fil' });
  const draw = () => {
    const shown = items.filter(n => !state.filter || state.filter === 'all' || n.state === state.filter);
    list.replaceChildren(...shown.map(n => eventRow(n, act)));
    bar.replaceChildren(...FILTERS.map(([key, label]) => chip({
      label: [label, h('small', null, key === 'all' ? items.length : items.filter(n => n.state === key).length)],
      pressed: (state.filter ?? 'all') === key,
      dataset: { nf: key },
      onClick: () => { state.filter = key; draw(); },
    })));
  };
  draw();
  return h('section', { class: 'card glass', dataset: { card: 'news' } },
    h('div', { class: 'ch' }, h('h3', null, 'News'), h('span', { class: 'cnt' }, 'what you have heard')),
    bar,
    list);
}
