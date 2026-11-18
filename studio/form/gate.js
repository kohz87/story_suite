// The Studio's gate field: the gate text in a box that is checked through the game's own grammar (model/gate.js) while it is typed.

import { h } from '../../ui/kit/dom.js';
import { setProblem } from './fields.js';
import { checkGateText } from '../model/gate.js';

/** Builds a gate row. `spec`: `{ key, label, hint, value, content, ownerId }`; `onChange(key, text)` runs on a committed edit (a blank gate is `''`).
 * Each keystroke re-checks the text: the first error (else the first warning) shows under the box; the text is kept as typed either way. */
export function gateField(spec, onChange) {
    const area = h('textarea', { class: 'txt2 st-long', rows: spec.rows ?? 2, placeholder: '—', 'aria-label': spec.label }, spec.value ?? '');
    area.value = spec.value ?? '';
    const row = h('div', { class: 'srow wide', dataset: { key: spec.key, type: 'gate' } },
        h('span', { class: 'lb' }, h('b', spec.label), spec.hint ? h('small', spec.hint) : null),
        h('span', { class: 'ctl' }, area));
    const check = () => {
        const text = area.value.trim();
        const found = text ? checkGateText(text, spec.content, spec.ownerId ?? null) : [];
        const worst = found.find(item => item.level === 'error') ?? found[0];
        setProblem(row, worst?.message ?? '');
        row.dataset.level = worst?.level ?? '';
        return found;
    };
    area.addEventListener('input', check);
    area.addEventListener('change', () => { check(); onChange?.(spec.key, area.value.trim()); });
    check();
    return row;
}
