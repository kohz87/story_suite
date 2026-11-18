// The Studio's sub-record list (mock `.subrow`): a titled group of rows, each with move up, move down and remove, and an add button.

import { h } from '../../ui/kit/dom.js';

/** Builds a group. `spec`: `{ title, items: [{ title, sub }], addLabel }`; `on`: `{ add(), move(index, step), remove(index) }`
 * (the caller changes the document and draws the group again). The first row cannot move up and the last cannot move down. */
export function subRecords(spec, on) {
    const items = spec.items ?? [];
    const rows = items.map((item, at) => h('div', { class: 'srow subrow', dataset: { index: String(at) } },
        h('span', { class: 'lb' }, h('b', item.title), item.sub ? h('small', item.sub) : null),
        h('span', { class: 'ctl' },
            h('button', { type: 'button', class: 'btn2', 'aria-label': `Move ${item.title} up`, disabled: at === 0, onClick: () => on.move?.(at, -1) }, '↑'),
            h('button', { type: 'button', class: 'btn2', 'aria-label': `Move ${item.title} down`, disabled: at === items.length - 1, onClick: () => on.move?.(at, 1) }, '↓'),
            h('button', { type: 'button', class: 'btn2 dng', 'aria-label': `Remove ${item.title}`, onClick: () => on.remove?.(at) }, '×'))));
    return h('div', { class: 'sgrp' },
        h('div', { class: 'gt' }, `${spec.title} · ${items.length}`),
        rows,
        h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2', onClick: () => on.add?.() }, spec.addLabel ?? '+ Add')));
}
