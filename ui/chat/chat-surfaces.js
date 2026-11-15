// Keeps the inline row on the latest reply and the people drawer above the input: moves, hides and folds them as the chat changes.
import { inlineRow } from './inline-row.js';
import { peopleDrawer } from './people-drawer.js';

function isUser(el) {
  return el.classList.contains('user') || el.getAttribute('is_user') === 'true';
}

/** Returns the newest message element that is not the user's (the one that carries the row), or null. */
export function latestReplyOf(messagesEl) {
  if (!messagesEl) return null;
  const all = messagesEl.querySelectorAll('.mes').filter(el => !isUser(el));
  return all.length ? all[all.length - 1] : null;
}

/** Decides the drawer: hidden when nobody is here, folded when closed or while typing on a narrow screen, and cards per page. */
export function drawerLayout(rows, { open = true, typing = false, narrow = false } = {}) {
  const hidden = !Array.isArray(rows) || rows.length === 0;
  return { hidden, folded: !open || (typing && narrow), perPage: narrow ? 2 : 4 };
}

/** Creates the controller: refresh(chatVm) redraws, setTyping(bool) and toggleDrawer() refold; options: messagesEl, drawerHost, handlers, isNarrow(). */
export function createChatSurfaces({ messagesEl, drawerHost, handlers = {}, isNarrow = () => false } = {}) {
  const on = handlers || {};
  let vm = null;
  let open = true;
  let typing = false;
  let page = 0;
  let rowEl = null;

  function drawRow() {
    if (rowEl) rowEl.remove();
    rowEl = null;
    const host = latestReplyOf(messagesEl);
    if (!host || !vm?.inlineRow) return;
    rowEl = inlineRow(vm.inlineRow, on);
    (host.querySelector('.bx') || host.querySelector('.mes_block') || host).appendChild(rowEl);
  }

  function drawDrawer() {
    if (!drawerHost) return;
    const narrow = Boolean(isNarrow());
    const layout = drawerLayout(vm?.drawer, { open, typing, narrow });
    if (layout.hidden) {
      drawerHost.setAttribute('hidden', '');
      drawerHost.replaceChildren();
      return;
    }
    drawerHost.removeAttribute('hidden');
    const pages = Math.ceil(vm.drawer.length / layout.perPage);
    page = Math.max(0, Math.min(pages - 1, page));
    drawerHost.replaceChildren(peopleDrawer(vm.drawer, {
      folded: layout.folded,
      page,
      perPage: layout.perPage,
      onToggle: () => { open = layout.folded ? true : !open; drawDrawer(); },
      onPage: p => { page = p; drawDrawer(); },
      onOpenPerson: id => on.onOpenPerson?.(id),
    }));
  }

  return {
    refresh(next) { vm = next || null; drawRow(); drawDrawer(); },
    setTyping(value) { const t = Boolean(value); if (t !== typing) { typing = t; drawDrawer(); } },
    toggleDrawer() { open = !open; drawDrawer(); },
  };
}
