// The Settings › Chat extras › Tabs panel: the four tabs under each reply in their order, moved by dragging ⠿ or with ↑ ↓, each with a switch
// that hides it. Stored for every chat (Story Block's `replyTabs`, through the page's onChange: settings.set extras.tabs); the strips follow it.
import { h } from '../../kit/dom.js';
import { toggle } from '../../kit/controls.js';
import { TAB_TEXT, readTabOrder, writeTabOrder } from '../../select/reply-tabs.js';

const KEY = 'extras.tabs';

/** Moves the row at `from` to `to` in `list` (a copy); a move off either end leaves the list as it is. */
export function moveTab(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const out = [...list];
  const [row] = out.splice(from, 1);
  out.splice(to, 0, row);
  return out;
}

/** The panel for the overlay `ctx` (ctx.settings.replyTabs: [{ id, on }]; ctx.onChange(key, value) stores) → one `.sgrp` element. */
export function replyTabsPanel(ctx) {
  let list = readTabOrder(writeTabOrder(ctx.settings?.replyTabs));
  let dragFrom = -1;
  const note = h('p', { class: 'fine stab-err', role: 'status', hidden: true });
  const rows = h('div', { class: 'stabs' });
  // (a move redraws the rows; a switch keeps its row, so the settings walk's tag on it stays)
  async function save(next, redraw = true) {
    list = next;
    if (redraw) draw();
    let answer;
    try { answer = await ctx.onChange?.(KEY, writeTabOrder(list)); } catch (error) { answer = { ok: false, message: String(error?.message ?? error) }; }
    if (answer?.ok === false) { note.textContent = String(answer.message || 'That was not saved.'); note.removeAttribute('hidden'); } else note.setAttribute('hidden', '');
    if (ctx.settings) ctx.settings.replyTabs = list.map(row => ({ ...row }));
  }
  function row(tab, at) {
    const text = TAB_TEXT[tab.id];
    const labelId = `stab-${tab.id}`;
    return h(
      'div',
      {
        class: 'srow stab', dataset: { tab: tab.id }, draggable: 'true',
        onDragstart: event => { dragFrom = at; event.dataTransfer?.setData?.('text/plain', tab.id); },
        onDragover: event => { if (dragFrom >= 0) event.preventDefault?.(); },
        onDrop: event => { event.preventDefault?.(); const from = dragFrom; dragFrom = -1; if (from >= 0) save(moveTab(list, from, at)); },
        onDragend: () => { dragFrom = -1; },
      },
      h('span', { class: 'grip', 'aria-hidden': 'true', title: 'Drag to move' }, '⠿'),
      h('span', { class: 'lb', id: labelId }, h('b', text.label), text.note ? h('small', text.note) : null),
      h('span', { class: 'ctl' },
        h('button', { type: 'button', class: 'btn2 ud', 'aria-label': `Move ${text.label} up`, disabled: at === 0, onClick: () => save(moveTab(list, at, at - 1)) }, '↑'),
        h('button', { type: 'button', class: 'btn2 ud', 'aria-label': `Move ${text.label} down`, disabled: at === list.length - 1, onClick: () => save(moveTab(list, at, at + 1)) }, '↓'),
        toggle({ checked: tab.on, labelledBy: labelId, onChange: on => save(list.map(item => (item.id === tab.id ? { ...item, on } : item)), false) })), // (list, not the row's own: a later move redraws)
    );
  }
  function draw() { rows.replaceChildren(...list.map(row)); }
  draw();
  return h(
    'div',
    { class: 'sgrp', dataset: { replyTabs: '1' } },
    h('div', { class: 'gt' }, 'Tabs'),
    h('p', { class: 'fine stab-hint' }, 'The tabs under each reply: the order they take and which ones show, for every chat. Drag a row by ⠿ (or use ↑ ↓); the switch hides a tab.'),
    rows,
    note,
  );
}
