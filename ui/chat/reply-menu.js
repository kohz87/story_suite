// Builds the "Story Suite: this reply" button for a message's action row and the sheet that lists that reply's changes and its state then.
import { h } from '../kit/dom.js';

/** Builds the ✦ button for a reply's action row; onOpen() opens the sheet. */
export function replyMenuButton(handlers = {}) {
  const label = 'Story Suite: this reply';
  return h('button', { type: 'button', class: 'xbt ss', title: label, 'aria-label': label, onClick: () => handlers?.onOpen?.() }, '✦');
}

function countsLine(counts) {
  const c = counts || {};
  const n = Number(c.changes) || 0;
  const parts = [`${n} change${n === 1 ? '' : 's'}`];
  if (Number(c.heldBack) > 0) parts.push(`${c.heldBack} held back`);
  if (Number(c.notApplied) > 0) parts.push(`${c.notApplied} not applied`);
  return parts.join(', ');
}

function lineItem(row) {
  return h(
    'li',
    { class: row.applied === false ? 'na' : null },
    row.glyph ? h('i', { 'aria-hidden': 'true' }, `${row.glyph} `) : null,
    String(row.line ?? ''),
    row.detail ? h('small', { class: 'dtl' }, ` · ${row.detail}`) : null,
    row.applied === false ? h('span', { class: 'tagx na' }, ' not applied') : null,
  );
}

function action(label, onClick) {
  return h('button', { type: 'button', class: 'ssbtn', onClick }, label);
}

/** Builds the "This reply" sheet from a replyMenu view-model; handlers: onReread, onOpenSuite(tab), onClose (a button shows only with its handler). */
export function replySheet(menu, handlers = {}) {
  const vm = menu || {};
  const on = handlers || {};
  const lines = Array.isArray(vm.lines) ? vm.lines : [];
  const then = vm.stateThen || {};
  const place = [then.place, then.weather].filter(Boolean).join(' · ');
  return h(
    'div',
    { class: 'trsheet', role: 'dialog', 'aria-label': 'Story Suite: this reply' },
    h('b', `This reply${vm.at ? ` · ${vm.at}` : ''}`),
    lines.length ? h('ul', lines.map(lineItem)) : h('ul', h('li', countsLine(vm.counts))),
    lines.length ? h('p', { class: 'fine cnt' }, countsLine(vm.counts)) : null,
    place ? h('small', `State then: ${place}`) : null,
    h(
      'span',
      { class: 'tra' },
      on.onReread ? action('Re-read this reply', () => on.onReread()) : null,
      on.onOpenSuite ? action('Open in Suite', () => on.onOpenSuite('now')) : null,
      on.onClose ? action('Close', () => on.onClose()) : null,
    ),
  );
}
