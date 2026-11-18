// The Studio's editable chip list (mock "editable chip list"): the values as removable pills and a short box that adds one on Enter or blur.

import { h } from '../../ui/kit/dom.js';

/** Builds a chip-list row. `spec`: `{ key, label, hint, values, placeholder, none, unique }`; `onChange(key, values)` gets the whole new list.
 * A blank add is ignored; with `unique` (the default) a value already in the list is not added twice. */
export function chipList(spec, onChange) {
    let values = [...(spec.values ?? [])];
    const box = h('div', { class: 'chips3' });
    const draw = () => {
        box.replaceChildren();
        if (!values.length) box.append(h('span', { class: 'none' }, spec.none ?? 'None'));
        values.forEach((value, at) => box.append(h('span', { class: 'kc' }, value,
            h('button', { type: 'button', 'aria-label': `Remove ${value}`, onClick: () => { values = values.filter((_, i) => i !== at); draw(); onChange?.(spec.key, [...values]); } }, '×'))));
        const add = h('input', { class: 'txt2 kadd', placeholder: spec.placeholder ?? 'Add…', 'aria-label': spec.placeholder ?? 'Add…' });
        const take = () => {
            const text = add.value.trim();
            if (!text) return;
            if (spec.unique !== false && values.includes(text)) { add.value = ''; return; }
            values = [...values, text]; draw(); onChange?.(spec.key, [...values]);
        };
        add.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault?.(); take(); } });
        add.addEventListener('change', take);
        box.append(add);
    };
    draw();
    return h('div', { class: 'srow wide', dataset: { key: spec.key, type: 'chips' } },
        h('span', { class: 'lb' }, h('b', spec.label), spec.hint ? h('small', spec.hint) : null),
        h('span', { class: 'ctl' }, box));
}
