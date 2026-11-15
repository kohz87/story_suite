// Supplies the default card and tab renderers for mountSuite: the character card, the Now tab, and a "not built yet" card.
import { h } from '../kit/dom.js';
import { characterCard } from '../card/character-card.js';
import { nowTab } from '../tabs/now/now.js';
import { createTabViews } from './tab-views.js';

const TITLES = {
  party: 'Party', bag: 'Bag', people: 'People', world: 'World', journal: 'Journal', story: 'Story', fight: 'Fight',
};

/** Builds the honest placeholder card for a tab that is not built yet. */
export function pendingCard(tab) {
  return h('section', { class: 'card glass su-pending', dataset: { pending: tab } },
    h('div', { class: 'ch' }, h('h3', TITLES[tab] ?? tab)),
    h('p', { class: 'su-pending-note' }, 'This tab is not built yet.'));
}

/** Returns the default `{ card, tab }` renderers wired to a port, back-stack and prefs. */
export function defaultViews({ port, tabHost = () => null, prefs = null, backStack = null, doc, onChat = null, onSettings = null, width = null, refresh = null }) {
  const go = (tab, args) => {
    if (tab === 'chat') { onChat?.(); return; }
    if (tab) tabHost()?.select(tab);
    if (args) port.command('suite.go', { tab, ...args });
  };
  const ctx = { port, prefs, go };
  const built = createTabViews({ port, prefs, go, backStack, doc, width, refresh });
  return {
    card: vm => (vm ? characterCard(vm, {
      onBack: () => port.command('suite.close', {}),
      onScene: () => port.command('suite.scene', {}),
      onSettings: () => (onSettings ? onSettings() : port.command('suite.settings', {})),
      onPace: () => go('bag'),
    }) : null),
    tab: (tab, vm) => (tab === 'now' && vm ? nowTab(vm, ctx) : built(tab, vm) ?? pendingCard(tab)),
  };
}
