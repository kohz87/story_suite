// The Studio's id picker: a sheet with a search box and a list of records to pick one from (mock "id picker sheet").

import { h } from '../../ui/kit/dom.js';
import { openSheet } from '../../ui/kit/sheet.js';

const matches = (item, needle) => !needle || `${item.label} ${item.sub ?? ''} ${item.id}`.toLowerCase().includes(needle);

/** Opens the picker. `spec`: `{ title, label, items: [{ id, label, sub, icon, tag, disabled }] }`; `onPick(id)` runs for a row that is not disabled, then the sheet closes.
 * Returns the sheet's `{ el, body, close }`. A disabled row (already used) stays in the list, marked with its tag. */
export function openPicker(ctx, spec, onPick) {
    const sheet = openSheet(ctx, { title: spec.title, label: spec.label ?? spec.title, id: 'st-pick' });
    const list = h('div', { class: 'slist' });
    const count = h('p', { class: 'fine' });
    const draw = (needle = '') => {
        const shown = (spec.items ?? []).filter(item => matches(item, needle.trim().toLowerCase()));
        list.replaceChildren(...shown.map(item => h('button', { type: 'button', dataset: { id: item.id }, 'aria-disabled': item.disabled ? 'true' : null,
            onClick: () => { if (item.disabled) return; sheet.close(); onPick?.(item.id); } },
            item.icon ? h('i', { 'aria-hidden': 'true' }, item.icon) : null,
            h('span', null, h('b', item.label, item.tag ? h('span', { class: 'tg2' }, item.tag) : null), item.sub ? h('small', item.sub) : null),
            h('span', { 'aria-hidden': 'true' }, '›'))));
        count.textContent = `${shown.length} of ${(spec.items ?? []).length} · Esc closes.`;
    };
    const search = h('input', { class: 'psrch txt2', placeholder: 'Search…', 'aria-label': spec.search ?? 'Search' });
    search.addEventListener('input', () => draw(search.value));
    sheet.body.append(search, list, count);
    draw();
    return sheet;
}
