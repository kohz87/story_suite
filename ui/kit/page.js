// Builds the pager bar for a multi-page screen, plus the page section and label-value list that page bodies share.
import { h } from './dom.js';

/** Returns `i of n` words and the neighbours (wrapping at both ends) for the current page id, or null when it is not in `pages`. */
function place(pages, current) {
  const i = pages.findIndex(p => p.id === current);
  if (i < 0) return null;
  return { i, prev: pages[(i + pages.length - 1) % pages.length], next: pages[(i + 1) % pages.length] };
}

/**
 * Builds the pager: ‹ back button, previous and next arrows around the page title ("i of n" and dots).
 * Options: pages [{ id, title }], current (page id), backLabel, onBack(), onGo(id).
 */
export function pager({ pages = [], current, backLabel = '‹ Back', onBack, onGo } = {}) {
  const at = place(pages, current);
  const arrow = (target, symbol, label) => h('button', {
    type: 'button', class: 'pb', 'aria-label': label, dataset: { act: label.toLowerCase(), go: target?.id },
    onClick: () => target && onGo?.(target.id),
  }, symbol);
  return h('div', { class: 'pager' },
    h('button', { type: 'button', class: 'bk2', dataset: { act: 'back' }, onClick: () => onBack?.() }, backLabel),
    h('span', { class: 'sp' }),
    at && pages.length > 1 ? arrow(at.prev, '‹', 'Previous') : null,
    at ? h('span', { class: 'ptl' },
      h('b', null, pages[at.i].title),
      h('small', null, `${at.i + 1} of ${pages.length}`),
      h('span', { class: 'pd' }, pages.map((p, j) => h('i', { class: j === at.i ? 'on' : null })))) : null,
    at && pages.length > 1 ? arrow(at.next, '›', 'Next') : null);
}

/** Builds a titled section of a page; returns null when there are no children (no empty headings). */
export function pageSection(title, ...children) {
  const kids = children.flat().filter(c => c !== null && c !== undefined && c !== false);
  if (!kids.length) return null;
  return h('div', { class: 'dpsec' }, title ? h('div', { class: 'secl' }, title) : null, ...kids);
}

/** Builds a label and value list from [label, value] rows, skipping empty values; returns null when nothing is left. */
export function kvList(rows = []) {
  const kept = rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (!kept.length) return null;
  return h('dl', { class: 'kv2' }, kept.map(([label, value]) => [h('dt', null, label), h('dd', null, value)]));
}
