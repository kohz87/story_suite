// The Studio's single-value form rows: text, long text, number, select, toggle and segmented, drawn as the mock's settings rows
// (`.srow` with `.txt2`, `.sel2`, `.num`, `.sw`, `.sseg2`), each able to show one inline problem line under its control.

import { h } from '../../ui/kit/dom.js';
import { renderRow } from '../../ui/settings/fields.js';

const SETTINGS_TYPE = { text: 'txt', number: 'num', select: 'sel', toggle: 'sw', segmented: 'seg' };

/** Shows (or, for an empty message, clears) the inline problem under a field row; the control is marked invalid with it. */
export function setProblem(row, message) {
    const old = row.querySelector('.st-problem');
    if (old) old.remove();
    const control = row.querySelector('input,select,textarea');
    if (!message) {
        row.classList.remove('bad');
        if (control) control.removeAttribute('aria-invalid');
        return row;
    }
    row.classList.add('bad');
    if (control) control.setAttribute('aria-invalid', 'true');
    row.append(h('small', { class: 'st-problem', role: 'alert' }, String(message)));
    return row;
}

/** Builds one field row. `spec`: `{ type: 'text' | 'long' | 'number' | 'select' | 'toggle' | 'segmented', key, label, hint, value, options, unit, problem }`;
 * `onChange(key, value, spec)` runs on a committed edit (a blank number is `null`, a bad number is ignored). */
export function fieldRow(spec, onChange) {
    const ctx = { onChange: (key, value) => onChange?.(key, value, spec) };
    let row;
    if (spec.type === 'long') {
        const area = h('textarea', { class: 'txt2 st-long', rows: spec.rows ?? 4, placeholder: '—', 'aria-label': spec.label }, spec.value ?? '');
        area.value = spec.value ?? '';
        area.addEventListener('change', () => ctx.onChange(spec.key, area.value));
        row = h('div', { class: 'srow wide', dataset: { key: spec.key, type: 'long' } },
            h('span', { class: 'lb' }, h('b', spec.label), spec.hint ? h('small', spec.hint) : null),
            h('span', { class: 'ctl' }, area));
    } else {
        row = renderRow({ ...spec, type: SETTINGS_TYPE[spec.type] ?? spec.type }, ctx);
    }
    return setProblem(row, spec.problem);
}
