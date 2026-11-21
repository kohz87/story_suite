// Builds the "Story Suite: this reply" button for a message's action row and its sheet: Re-read, Discard repair (the undo) and Open Suite.
// The reply's change list is its card's Changes tab.
import { h } from '../kit/dom.js';

/** Builds the ✦ button for a reply's action row, one of SillyTavern's own message buttons (a `.mes_button` div, its size and fade: owner, 20 Nov: a bigger
 *  button of its own pushed the row taller); onOpen() opens the sheet. The click goes no further, so the page's own message handlers do not take it. */
export function replyMenuButton(handlers = {}) {
  const label = 'Story Suite: this reply';
  const open = e => { e?.preventDefault?.(); e?.stopPropagation?.(); handlers?.onOpen?.(); };
  return h('div', { class: 'mes_button ss-star', title: label, 'aria-label': label, role: 'button', tabindex: '0', onClick: open,
    onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') open(e); } }, '✦');
}

function action(label, onClick) {
  return h('button', { type: 'button', class: 'ssbtn', onClick }, label);
}

/** Builds the "This reply" sheet from a replyMenu view-model; handlers: onReread, onOpenSuite(tab), onDiscard (shown only when the reply holds a repair: vm.repaired), onClose (a button shows only with its handler). */
export function replySheet(menu, handlers = {}) {
  const vm = menu || {};
  const on = handlers || {};
  return h(
    'div',
    { class: 'trsheet', role: 'dialog', 'aria-label': 'Story Suite: this reply' },
    h('b', `This reply${vm.at ? ` · ${vm.at}` : ''}`),
    h('p', { class: 'fine' }, 'Its changes are on the Changes tab under it.'),
    h(
      'span',
      { class: 'tra' },
      on.onReread ? action('Re-read this reply', () => on.onReread()) : null,
      on.onDiscard && vm.repaired === true ? action('Discard repair', () => on.onDiscard()) : null,
      on.onOpenSuite ? action('Open Suite', () => on.onOpenSuite('now')) : null,
      on.onClose ? action('Close', () => on.onClose()) : null,
    ),
  );
}
