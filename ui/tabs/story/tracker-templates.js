// Builds the "Add from a template" sheet: one row per template with an Add button; a refusal (for example the chat is full) shows under the list.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';

/** Builds the list; `onAdd(id)` returns a promise of the engine's answer ({ ok, message? }); `onClose()` is called on success and by Cancel. */
export function templatesSheet(templates, { onAdd, onClose } = {}) {
  const note = h('p', { class: 'fine', role: 'status' }, 'A new tracker starts hidden from Now: switch Show on Now on when you want it there.');
  const add = async (id) => {
    const answer = await onAdd?.(id);
    if (answer?.ok === false) note.textContent = String(answer.message || 'That tracker could not be added.');
    else onClose?.();
  };
  return h('div', { class: 'qsheet trksheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Add a tracker from a template' },
    h('div', { class: 'qeh' }, h('div', { class: 'dn' }, 'Add from a template'), button({ label: '×', icon: h('span', null, '×'), tone: 'icon', ariaLabel: 'Close', className: 'x qclose', onClick: () => onClose?.() })),
    templates.map(t => h('div', { class: 'srow', dataset: { template: t.id } }, h('span', { class: 'lb' }, h('b', t.name), h('small', t.about)), h('span', { class: 'ctl' }, button({ label: 'Add', tone: 'primary', className: 'add', onClick: () => add(t.id) })))),
    note,
    h('div', { class: 'brow' }, button({ label: 'Cancel', className: 'cancel', onClick: () => onClose?.() })));
}
