// The chip, pencil and editor props the block layouts share, with the view words.
import { h } from '../../view/widgets/dom.js';
import { editable } from '../../view/widgets/editable.js';
import { STRINGS } from '../../../../../../core/strings.js';

export const V = STRINGS.blocks.view;
const TONE_CLASS = { accent: 'accent', active: 'accent', done: 'good', good: 'good', failed: 'bad', bad: 'bad', warn: 'warn', neutral: 'neutral' };
const chipTone = tone => TONE_CLASS[tone] ?? 'neutral';

export function chip(doc, text, tone) {
    const out = h(doc, 'span', `ss-l-badge ss-l-tone-${chipTone(tone)} ss-b-chip`);
    out.appendChild(h(doc, 'span', 'ss-l-value', text));
    return out;
}

/** The pencil beside a value: the editable widget with no shown value (the caller draws it), its command wrapped so the pencil keeps the focus. */
export function pencilFor(env, parent, props, mark) {
    const slot = h(env.doc, 'span', 'ss-b-pen');
    parent.appendChild(slot);
    const run = typeof env.api?.command === 'function' ? async (type, payload) => {
        const focused = slot.contains(env.doc.activeElement);
        const result = await env.api.command(type, payload);
        if (result?.ok && focused) env.after?.(mark);
        return result;
    } : undefined;
    env.handles.push(editable.render(slot, { displayValue: false, ...props }, { command: run }));
    const pencil = slot.querySelector('.ss-w-editable-pencil');
    for (const [name, value] of Object.entries(mark ?? {})) pencil?.setAttribute(`data-block-${name}`, String(value ?? ''));
    return slot;
}

export function editorProps(module, field, key, scalar, label, who) {
    const props = { label, command: 'dm.set', payload: { module, field, ...(who ? { who } : {}), ...(key ? { key } : {}) } };
    if (scalar.type === 'int') Object.assign(props, { kind: 'number', min: scalar.min, max: scalar.max });
    else if (scalar.type === 'enum') Object.assign(props, { kind: 'choice', options: scalar.values });
    else if (scalar.type === 'bool') Object.assign(props, { kind: 'choice', options: [true, false] });
    else Object.assign(props, { kind: 'text', maxLength: scalar.max });
    return props;
}
