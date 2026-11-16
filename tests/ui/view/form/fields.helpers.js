import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { newId } from '../../../../ui/legacy/view/form/fields.js';

export const doc = installFakeDom();
export const classes = node => node.classes();
export function make(renderer, field, value, extra = {}) {
    const calls = [];
    const invalid = [];
    const notes = [];
    const ctx = {
        doc, id: newId('t'), key: 'k', field, value, label: 'Label', labelledBy: 'lbl', disabled: false, readOnly: false, memo: new Map(),
        onChange: (next, meta) => calls.push([next, meta]), invalid: message => invalid.push(message), note: message => notes.push(message), ...extra,
    };
    const handle = renderer(ctx);
    doc.body.appendChild(handle.el);
    return { handle, calls, invalid, notes, el: handle.el, input: handle.input };
}
