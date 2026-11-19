// Supplies the default card and tab renderers for mountSuite: the character card and a "not built yet" card.
import { h } from '../kit/dom.js';
import { characterCard } from '../card/character-card.js';
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
  let openId = null;
  let journalStart = null;
  const openDossier = (personId) => {
    const vm = port.view('dossier')?.[personId];
    const host = tabHost()?.el?.parentNode;
    if (!vm || !host) return;
    dossier?.close();
    const from = tabHost().current();
    const opener = doc?.activeElement ?? null;
    const el = dossierPage(vm, {
      port, prefs, backStack, go, youName: port.view('card')?.you?.name, origin: `‹ ${TITLES[from] ?? 'Party'}`,
      // (the library, a tie or the map showed another person in place: a redraw after a reply reads that one)
      onPerson: (id) => { if (dossier === el) openId = id; },
      onClose: () => {
        const had = !doc?.activeElement || doc.activeElement === doc.body || el.contains(doc.activeElement);
        el.remove();
        if (dossier === el) dossier = null;
        if (from !== 'people') tabHost()?.select(from);
        if (had) giveBack(host, opener, openId ?? personId);
      },
    });
    dossier = el;
    openId = personId;
    host.appendChild(el);
    el.querySelector('[data-act="close"]')?.focus();
  };
  // The dossier closed with the focus in it: back to the card that opened it, or (redrawn meanwhile) that person's card, or the suite.
  const giveBack = (host, opener, personId) => {
    const card = [...host.querySelectorAll('[data-person-id]')].find(node => node.dataset.personId === personId && !node.closest('.dossier'));
    const target = opener && opener !== doc.body && doc.body?.contains?.(opener) ? opener : card ?? host.closest?.('.su-root');
    target?.focus?.({ preventScroll: true });
  };
  const go = (tab, args) => {
    const opening = tab === 'people' && args?.personId;
    if (!opening) dossier?.close();
    if (tab === 'chat') { onChat?.(); return; }
    if (opening) openDossier(args.personId);
    // (a dossier's Day ›: the Journal opens its calendar on that day, once)
    if (tab === 'journal' && args?.day) journalStart = { day: String(args.day) };
    if (tab) tabHost()?.select(tab);
    // (a dossier opened over the Journal: the tab was already drawn as the dossier closed, so it is drawn again to take the day)
    if (journalStart && tabHost()?.current() === 'journal') refresh?.();
    if (args) port.command('suite.go', { tab, ...args });
  };
  const ctx = { port, prefs, go };
  const built = createTabViews({ port, prefs, go, backStack, doc, width, refresh, journalStart: () => { const s = journalStart; journalStart = null; return s; } });
  return {
    // A person's page left open: closed when the suite is opened on a tab (it would cover the tab asked for).
    closePage: () => dossier?.close(),
    // The open dossier's record as it is now (null when none is open), and a redraw of it from a fresh read.
    hasDossier: () => dossier !== null,
    openDossier: () => (dossier ? port.view('dossier')?.[openId] ?? null : null),
    updateDossier: vm => dossier?.update?.(vm),
    // The first of `keys` (a store id or a lower-case name) that has a dossier, or null.
    personKey: (keys) => {
      const known = port.view('dossier') ?? {};
      return (Array.isArray(keys) ? keys : [keys]).find(item => typeof item === 'string' && item && Object.hasOwn(known, item)) ?? null;
    },
    // Opens the first of `keys` that has a dossier, over the People tab; false when none has one.
    openPerson(keys) {
      const key = this.personKey(keys);
      if (!key) return false;
      go('people', { personId: key });
      return true;
    },
    card: vm => (vm ? characterCard(vm, {
      onBack: () => onChat?.(),
      onScene: () => openSceneSheet({ port, doc, backStack, refresh }, vm.scene, (port.view('now')?.here ?? []).map(p => p.name)),
      onSettings: () => (onSettings ? onSettings() : port.command('suite.settings', {})),
      onPace: () => go('bag'),
    }) : null),
    tab: (tab, vm) => built(tab, vm) ?? pendingCard(tab),
  };
}
