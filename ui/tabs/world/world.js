// Composes the World tab: a Map / News / Factions switch over one body, the place sheet, and links between the views.
import { h } from '../../kit/dom.js';
import { segmented } from '../../kit/controls.js';
import { mapCard, markSelected } from './map.js';
import { placeSheet } from './place-sheet.js';
import { newsCard } from './news.js';
import { factionsCard } from './factions.js';

const VIEW_LABELS = Object.freeze({ map: 'Map', news: 'News', factions: 'Factions' });
const DIRECTOR_NOTE = 'News that has not reached you yet lives in Story › Director, behind the plan switch.';
const list = value => (Array.isArray(value) ? value : []);

/** Builds the World tab from a `world` view-model; ctx = { rpg, width, go(tab, args), edit(target), back }. Views with nothing to show are left out. */
export function worldTab(world = {}, ctx = {}) {
  const data = {
    places: list(world.places), routes: list(world.routes), trip: world.trip ?? null,
    terrain: world.terrain ?? null,
    news: list(world.news).map(n => ({ ...n, heard: list(n.heard) })), factions: list(world.factions),
  };
  const available = [data.places.length && 'map', data.news.length && 'news', data.factions.length && 'factions'].filter(Boolean);
  const state = { view: available.includes(ctx.view) ? ctx.view : available[0], selected: null, center: null, filter: 'all' };
  const body = h('div', { class: 'wbody' });
  const root = h('div', { class: 'world-tab', dataset: { tab: 'world' } });
  const names = (items, id) => items.find(x => x.id === id)?.name ?? null;
  let sheet = null;
  let unback = null;

  function closeSheet() {
    if (!sheet) return;
    sheet.remove();
    sheet = null;
    state.selected = null;
    if (unback) unback();
    unback = null;
    markSelected(body, null);
  }
  const act = {
    placeName: id => names(data.places, id),
    factionName: id => names(data.factions, id),
    edit: target => ctx.edit?.(target),
    openPerson: personId => ctx.go?.('people', { personId }),
    setView(view) { closeSheet(); state.view = view; render(); },
    openPlace(id) {
      const place = data.places.find(p => p.id === id);
      if (!place) return;
      closeSheet();
      state.selected = id;
      markSelected(body, id);
      sheet = placeSheet(place, data, ctx, closeSheet);
      root.appendChild(sheet);
      unback = ctx.back?.push({ layer: 'sheet', close: closeSheet }) ?? null;
    },
    gotoPlace(id) { closeSheet(); state.view = 'map'; state.center = id; render(); act.openPlace(id); },
  };

  function render() {
    const cards = {
      map: () => mapCard(data, state, act, ctx),
      news: () => newsCard(data.news, state, act),
      factions: () => factionsCard(data.factions, data.news, act),
    };
    const card = state.view ? cards[state.view]() : h('p', { class: 'fine' }, 'Nothing is known about the world yet.');
    body.replaceChildren(...[card, state.view === 'news' ? h('p', { class: 'fine' }, DIRECTOR_NOTE) : null].filter(Boolean));
    root.dataset.view = state.view ?? 'none';
    for (const b of root.querySelectorAll('.wseg button')) b.setAttribute('aria-pressed', String(b.dataset.value === state.view));
  }

  const seg = available.length > 1
    ? segmented({ items: available.map(v => [v, v === 'news' ? ['News ', h('small', null, data.news.length)] : VIEW_LABELS[v]]), value: state.view, label: 'World views', className: 'wseg', onChange: v => act.setView(v) })
    : null;
  root.append(...[seg, body].filter(Boolean));
  render();
  return root;
}
