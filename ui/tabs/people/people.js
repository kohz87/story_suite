// Composes the People tab: header with List/Map switch, search, filters, the Here / Elsewhere / Deceased lists, or the cast map.
import { h } from '../../kit/dom.js';
import { segmented, button } from '../../kit/controls.js';
import { personCard } from './person-card.js';
import { castMap } from './map.js';

const FILTERS = Object.freeze([['all', 'All'], ['party', 'Party'], ['followed', '★ Following'], ['deceased', 'Deceased'], ['dormant', 'Not seen lately']]);
const LEGEND = Object.freeze([['f0', 'Trust'], ['f1', 'Affection'], ['f2', 'Desire'], ['f3', 'Tension']]);
const FILTER_IDS = FILTERS.map(f => f[0]);

/** Splits a People view-model into the lists a filter and search shows: { sections: [{ title, kind, people }], found } (dormant comes from vm.dormant when the engine sends it). */
export function selectPeople(vm = {}, filter = 'all', query = '') {
  const here = vm.here ?? [];
  const elsewhere = vm.elsewhere ?? [];
  const deceased = vm.deceased ?? [];
  const dormant = vm.dormant ?? [];
  const q = String(query).trim().toLowerCase();
  const match = p => `${p.name} ${p.role ?? ''}`.toLowerCase().includes(q);
  const keep = filter === 'party' ? p => p.inParty : filter === 'followed' ? p => p.followed : () => true;
  const tag = (list, kind) => list.map(p => ({ p, kind }));
  if (q) {
    const all = [...tag(here, 'here'), ...tag(elsewhere, 'elsewhere'), ...tag(deceased, 'deceased'), ...tag(dormant, 'dormant')];
    return { sections: [{ title: 'Found', kind: 'found', people: all.filter(x => match(x.p)) }], found: true };
  }
  if (filter === 'deceased') return { sections: [{ title: null, kind: 'deceased', people: tag(deceased, 'deceased') }], found: false };
  if (filter === 'dormant') return { sections: [{ title: 'Not seen lately · hidden from All until seen again', kind: 'dormant', people: tag(dormant, 'dormant') }], found: false };
  return {
    sections: [
      { title: 'Here', kind: 'here', people: tag(here.filter(keep), 'here') },
      { title: 'Elsewhere', kind: 'elsewhere', people: tag(elsewhere.filter(keep), 'elsewhere') },
    ].filter(s => s.people.length),
    found: false,
  };
}

/**
 * Builds the People tab from a `people` view-model; ctx = { port, go(tab, args), peopleStart() } (peopleStart returns a one-time { view, focus } the dossier's See on map leaves). Opening a person calls ctx.go('people', { personId }).
 * Local state (filter, search, list or map, lens, picked, focus) lives in the tab and redraws only the lists, so the search box keeps focus.
 */
export function peopleTab(vm = {}, ctx = {}) {
  const start = ctx.peopleStart?.() ?? null;
  const state = { filter: FILTER_IDS.includes(vm.filter) ? vm.filter : 'all', query: '', view: start?.view === 'map' ? 'map' : 'list', lens: 'warmth', sel: start?.focus ?? null, focus: start?.focus ?? null };
  const counts = vm.counts ?? {};
  const open = personId => ctx.go?.('people', { personId });
  const filterBar = h('div', { class: 'fil', role: 'group', 'aria-label': 'Filter' });
  const body = h('div', { class: 'people-body' });
  const legend = h('div', { class: 'legend' }, LEGEND.map(([cls, text]) => h('span', { class: cls }, h('i'), text)));
  const viewSwitch = h('span', { class: 'view-switch' });

  function drawFilters() {
    const shown = FILTERS.filter(([id]) => id !== 'dormant' || (counts.notSeenLately ?? vm.notSeenLately ?? 0) > 0);
    filterBar.replaceChildren(...shown.map(([id, label]) => h('button', {
      type: 'button',
      'aria-pressed': String(id === state.filter),
      dataset: { filter: id },
      onClick: () => { state.filter = id; draw(); },
    }, label, h('small', null, String(id === 'dormant' ? (counts.notSeenLately ?? vm.notSeenLately ?? 0) : (counts[id] ?? 0))))));
  }

  function drawList() {
    const { sections, found } = selectPeople(vm, state.filter, state.query);
    const total = sections.reduce((n, s) => n + s.people.length, 0);
    const nodes = sections.map(s => h('section', { class: 'psec', dataset: { section: s.kind } },
      s.title ? h('div', { class: 'secl2' }, `${s.title}${s.kind === 'here' || s.kind === 'elsewhere' || found ? ` · ${s.people.length}` : ''}`) : null,
      h('div', { class: 'pgrid' }, s.people.map(({ p, kind }) => personCard(p, { kind, onOpen: open })))));
    if (!total) {
      const dormantN = counts.notSeenLately ?? vm.notSeenLately ?? 0;
      const text = state.filter === 'dormant' && !state.query && dormantN
        ? `${dormantN} not seen lately. They come back here when seen again.`
        : (state.query ? 'Nobody found.' : 'No one here.');
      nodes.push(h('p', { class: 'fine' }, text));
    }
    if (state.filter === 'dormant' && !state.query) {
      nodes.push(h('button', { type: 'button', class: 'lnk2', onClick: () => { state.filter = 'all'; draw(); } }, '‹ Back to everyone'));
    }
    body.replaceChildren(...nodes);
  }

  function drawMap() {
    const people = [...(vm.here ?? []).map(p => ({ ...p, here: true })), ...(vm.elsewhere ?? []).map(p => ({ ...p, here: false }))];
    body.replaceChildren(castMap({
      people, ties: vm.ties ?? [], state, ctx, you: ctx.you ?? { name: 'You' },
      handlers: {
        lens: (id) => { state.lens = id; drawMap(); },
        pick: (id) => { state.sel = state.sel === id ? null : id; drawMap(); },
        focus: (id) => { state.focus = id; if (id) state.sel = id; drawMap(); },
      },
    }));
  }

  function draw() {
    drawFilters();
    viewSwitch.replaceChildren(segmented({
      items: [['list', 'List'], ['map', 'Map']], value: state.view, label: 'View', className: 'seg2',
      onChange: (v) => { state.view = v; draw(); },
    }));
    filterBar.hidden = state.view === 'map';
    legend.hidden = state.view === 'map';
    if (state.view === 'map') drawMap(); else drawList();
  }

  const search = h('input', {
    class: 'psrch', type: 'search', placeholder: 'Find anyone, even people not seen lately', 'aria-label': 'Find a person',
    onInput: (event) => { state.query = event.target.value ?? ''; if (state.view === 'list') drawList(); },
  });
  draw();
  return h('div', { class: 'people-tab', dataset: { tab: 'people' } },
    h('section', { class: 'card glass' },
      h('div', { class: 'phd' },
        h('h3', null, 'People'),
        h('span', { class: 'cnt' }, `${counts.all ?? 0} known`),
        viewSwitch,
        button({ label: '+ Add', onClick: () => ctx.port?.command?.('npc.add', {}) })),
      search, filterBar, legend, body));
}
