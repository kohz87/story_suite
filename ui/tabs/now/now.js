// Composes the Now tab in phone order: Right now, Here, This turn, You, Pinned; two columns when the container is wide.
import { h } from '../../kit/dom.js';
import { rightNow } from './right-now.js';
import { hereCard } from './here.js';
import { thisTurnCard } from './this-turn.js';
import { youCard, pinnedCards } from './you-pinned.js';

/** Builds the Now tab from a `now` view-model; ctx = { prefs, go(tab, args) }. Empty cards are left out. */
export function nowTab(now = {}, ctx = {}) {
  const left = [rightNow(now, ctx), thisTurnCard(now.thisTurn, ctx), youCard(now.you, ctx)];
  const right = [hereCard(now.here, ctx), pinnedCards(now.pinned)];
  // A new chat has nothing to draw yet: say so, rather than leave a blank panel.
  const drawn = [...left.flat(), ...right.flat()].filter(Boolean);
  return h(
    'div',
    { class: 'now-tab', dataset: { tab: 'now' } },
    h('div', { class: 'ncol' }, left),
    h('div', { class: 'ncol' }, right),
    drawn.length ? null : h('p', { class: 'fine', dataset: { note: 'now-empty' } }, 'Nothing to show yet. Where you are, who is here and what a reply changed appear here as the story goes on.'),
  );
}
