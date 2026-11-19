// Builds the card under one story reply: its own time, place and weather, HP·MP·SP and condition on top, the tabs under them, and on the
// newest reply the ⧉ Open Suite corner button and the action line. Drawn in the page only: never in the message text, never sent.
import { h } from '../kit/dom.js';
import { replyBoxTop } from './reply-box-top.js';
import { replyBoxTabs } from './reply-box-tabs.js';
import { replyBoxActions } from './reply-box-actions.js';

/**
 * The card of reply `card` (one of the chat view's `replies`). opts: `newest` (the corner button and the action line), `actions` (head.actions),
 * `order` (the tab order), `open` (the open tab's id or null), `onTab(id|null)`, `on` (the handlers: onOpenSuite(tab), the action line's, onOpenPerson, onChoice).
 */
export function replyBox(card, { newest = false, actions = null, order = [], open = null, onTab = () => {}, on = {} } = {}) {
  const handlers = on || {};
  const corner = newest
    ? h('button', { type: 'button', class: 'cnr', title: 'Open the Suite', 'aria-label': 'Open Suite', onClick: () => handlers.onOpenSuite?.('now') }, '⧉')
    : null;
  return h(
    'div',
    { class: ['ssrc', newest ? 'newest' : null], dataset: { ssCard: '1', index: String(card.index) } },
    corner,
    replyBoxTop(card.top),
    replyBoxTabs(card, { order, open, onTab, on: handlers }),
    newest ? replyBoxActions(actions, handlers) : null,
  );
}
