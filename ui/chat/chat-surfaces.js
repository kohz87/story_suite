// Keeps one card under every story reply (its own state, tabs and, on the newest, the corner button and action line) and the modules' cards under
// the head reply: draws, moves and removes them as the chat changes, and keeps which tab is open per reply across redraws.
import { replyBox } from './reply-box.js';
import { replyCardStrip } from './reply-cards.js';

const isUser = el => el.classList.contains('user') || el.getAttribute('is_user') === 'true';
const boxOf = host => host.querySelector('.bx') || host.querySelector('.mes_block') || host;

/** Returns the newest message element that is not the user's, or null. */
export function latestReplyOf(messagesEl) {
  if (!messagesEl) return null;
  const all = [...messagesEl.querySelectorAll('.mes')].filter(el => !isUser(el));
  return all.length ? all[all.length - 1] : null;
}

/** The indexes (`mesid`) of the reply messages drawn in `messagesEl`, in page order: the ones a card can go under. */
export function drawnReplies(messagesEl) {
  if (!messagesEl) return [];
  return [...messagesEl.querySelectorAll('.mes')].filter(el => !isUser(el)).map(el => Number(el.getAttribute('mesid'))).filter(Number.isInteger);
}

/** The tab a reply's card rests with: the newest reply's Choices when it shows them, else none (shut). */
export function restingTab(card, { newest = false, order = [] } = {}) {
  const shown = (Array.isArray(order) ? order : []).some(row => row?.id === 'choices' && row.on !== false);
  return newest && shown && card?.choices?.length ? 'choices' : null;
}

/** Creates the controller: refresh(chatVm) redraws. Options: messagesEl (SillyTavern's #chat), handlers (the cards' and the modules' cards' buttons: onCardAction(action) and the reply card's). */
export function createChatSurfaces({ messagesEl, handlers = {} } = {}) {
  const on = handlers || {};
  const drawn = new Map(); // index → { el, sig } (a card whose view did not change is left as it is: its strip keeps its scroll)
  const picked = new Map(); // index → the tab the reader opened or shut (null), until a new reply comes
  let head = null;
  let cardsEl = null;
  let vm = null;

  const hostOf = index => messagesEl?.querySelector?.(`.mes[mesid="${index}"]`) ?? null;

  function drawCard(card) {
    const host = hostOf(card.index);
    if (!host || isUser(host)) return;
    const newest = vm?.head?.index === card.index;
    const order = vm?.tabs ?? [];
    const open = picked.has(card.index) ? picked.get(card.index) : restingTab(card, { newest, order });
    const actions = newest ? vm.head.actions : null;
    const sig = JSON.stringify([card, newest, actions, order, open]);
    const old = drawn.get(card.index);
    const box = boxOf(host);
    if (old && old.sig === sig && old.el.parentNode === box) return;
    const el = replyBox(card, { newest, actions, order, open, on, onTab: id => { picked.set(card.index, id); drawCard(card); } });
    if (!el.children.length) { old?.el.remove(); drawn.delete(card.index); return; }
    if (old?.el.parentNode === box) { box.insertBefore(el, old.el); old.el.remove(); }
    else { old?.el.remove(); box.appendChild(el); }
    drawn.set(card.index, { el, sig });
  }

  // The modules' cards go under the head reply (by its index), below its card.
  function drawCards() {
    cardsEl?.remove();
    cardsEl = null;
    const cards = vm?.replyCards;
    const host = cards ? hostOf(cards.index) : null;
    if (!host) return;
    cardsEl = replyCardStrip(cards.list, action => on.onCardAction?.(action));
    if (cardsEl) boxOf(host).appendChild(cardsEl);
  }

  return {
    refresh(next) {
      vm = next || null;
      // a new reply: every older one rests again (shut; the newest with its choices open)
      const index = vm?.head?.index ?? null;
      if (index !== head) { picked.clear(); head = index; }
      const cards = Array.isArray(vm?.replies) ? vm.replies : [];
      const keep = new Set(cards.map(card => card.index));
      for (const [at, item] of [...drawn]) if (!keep.has(at)) { item.el.remove(); drawn.delete(at); }
      for (const card of cards) drawCard(card);
      drawCards();
    },
    /** Takes every card away (the view turned off). */
    clear() { for (const item of drawn.values()) item.el.remove(); drawn.clear(); cardsEl?.remove(); cardsEl = null; },
  };
}
