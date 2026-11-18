// Composes the Now tab in phone order: Right now, Here, This turn, You, Pinned; two columns when the container is wide. On desktop (layout A) Here lives in the left column as Here now, so Now leaves it out.
import { h } from '../../kit/dom.js';
import { rightNow } from './right-now.js';
import { hereCard } from './here.js';
import { thisTurnCard } from './this-turn.js';
import { youCard, pinnedCards } from './you-pinned.js';

/** Builds the Now tab from a `now` view-model; ctx = { prefs, go(tab, args), desk() }. Empty cards are left out. On desktop: Needs you and Today | This reply, You and the pinned trackers. */
export function nowTab(now = {}, ctx = {}) {
  const desk = ctx.desk?.() === true;
  const left = desk ? [rightNow(now, ctx)] : [rightNow(now, ctx), thisTurnCard(now.thisTurn, ctx), youCard(now.you, ctx)];
  const right = desk ? [thisTurnCard(now.thisTurn, ctx), youCard(now.you, ctx), pinnedCards(now.pinned)] : [hereCard(now.here, ctx), pinnedCards(now.pinned)];
  const drawn = [...left.flat(), ...right.flat()].filter(Boolean);
  return h(
    'div',
    { class: 'now-tab', dataset: { tab: 'now' } },
    h('div', { class: 'ncol' }, left),
    h('div', { class: 'ncol' }, right),
    drawn.length ? null : h('p', { class: 'fine now-empty', dataset: { note: 'now-empty' } }, 'Nothing here yet. The place, the time and what changed show up here after the first reply.'),
  );
}
