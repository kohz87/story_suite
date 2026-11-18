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
  // Nothing to draw yet (a fresh chat): one plain line instead of a blank page.
  const empty = ![...left, ...right].flat().some(Boolean);
  if (empty) left.push(h('p', { class: 'fine now-empty' }, 'Nothing here yet. The place, the time and what changed show up here after the first reply.'));
  return h(
    'div',
    { class: 'now-tab', dataset: { tab: 'now' } },
    h('div', { class: 'ncol' }, left),
    h('div', { class: 'ncol' }, right),
  );
}
