// Supplies the default card and tab renderers for mountSuite: the character card, the Now tab, and a "not built yet" card.
import { h } from '../kit/dom.js';
import { characterCard } from '../card/character-card.js';
import { nowTab } from '../tabs/now/now.js';
import { openSceneSheet } from '../sheets/scene-sheet.js';
import { createTabViews } from './tab-views.js';
import { dossierPage } from '../tabs/people/dossier/dossier.js';

const TITLES = {
  party: 'Party', bag: 'Bag', people: 'People', world: 'World', journal: 'Journal', story: 'Story', scene: 'Activity', fight: 'Fight',
};

/** Builds the honest placeholder card for a tab that is not built yet. */
export function pendingCard(tab) {
  return h('section', { class: 'card glass su-pending', dataset: { pending: tab } },
    h('div', { class: 'ch' }, h('h3', TITLES[tab] ?? tab)),
    h('p', { class: 'su-pending-note' }, 'This tab is not built yet.'));
}

/** Returns the default `{ card, tab, closePage }` renderers wired to a port, back-stack and prefs. */
export function defaultViews({ port, tabHost = () => null, prefs = null, backStack = null, doc, onChat = null, onSettings = null, width = null, refresh = null }) {
  let dossier = null;
  let peopleStart = null;
  const openDossier = (personId) => {
    const vm = port.view('dossier')?.[personId];
    const host = tabHost()?.el?.parentNode;
    if (!vm || !host) return;
    dossier?.close();
    const from = tabHost().current();
    let stay = false;
    const el = dossierPage(vm, {
      port, prefs, backStack, go, youName: port.view('card')?.you?.name, origin: `‹ ${TITLES[from] ?? 'Now'}`,
      seeOnMap: (id) => {
        stay = true;
        el.close();
        peopleStart = { view: 'map', focus: id };
        const already = tabHost().current() === 'people';
        tabHost().select('people');
        if (already) refresh?.();
      },
      onClose: () => { el.remove(); if (dossier === el) dossier = null; if (!stay && from !== 'people') tabHost()?.select(from); },
    });
    dossier = el;
    host.appendChild(el);
  };
  const go = (tab, args) => {
    const opening = tab === 'people' && args?.personId;
    if (!opening) dossier?.close();
    if (tab === 'chat') { onChat?.(); return; }
    if (opening) openDossier(args.personId);
    if (tab) tabHost()?.select(tab);
    if (args) port.command('suite.go', { tab, ...args });
  };
  const takeStart = () => { const s = peopleStart; peopleStart = null; return s; };
  const ctx = { port, prefs, go };
  const built = createTabViews({ port, prefs, go, backStack, doc, width, refresh, peopleStart: takeStart });
  return {
    // A person's page left open: closed when the suite is opened on a tab (it would cover the tab asked for).
    closePage: () => dossier?.close(),
    card: vm => (vm ? characterCard(vm, {
      onBack: () => onChat?.(),
      onScene: () => openSceneSheet({ port, doc, backStack, refresh }, vm.scene, (port.view('now')?.here ?? []).map(p => p.name)),
      onSettings: () => (onSettings ? onSettings() : port.command('suite.settings', {})),
      onPace: () => go('bag'),
    }) : null),
    tab: (tab, vm) => (tab === 'now' && vm ? nowTab(vm, ctx) : built(tab, vm) ?? pendingCard(tab)),
  };
}
