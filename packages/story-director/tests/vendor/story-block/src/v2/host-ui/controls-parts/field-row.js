// One settings row: the label and help beside the control, disabled when the field is read-only.

import { normalizeField, FIELD_TYPES } from '../../registry.js';
import { profileNote } from '../../profile-field.js';
import { el, humanize } from './dom.js';
import { control } from './field-control.js';

// `label.story-suite-row`: the label and its help on the left, the control on the right (stacked on a
// phone, host.css). A list's row is a `div` whose list group is named by the label. A read-only row
// shows its value and help with every control in it disabled, and stores nothing.
export function fieldRow(doc, key, field, value, onChange, prefix, memo = null, readOnly = false) {
    const f = normalizeField(field);
    // A type this Story Block does not know (a newer module's): hidden, its value left alone.
    if (!FIELD_TYPES.includes(f?.type)) {
        const hidden = el(doc, 'div', 'story-suite-row');
        hidden.dataset.field = key;
        hidden.hidden = true;
        return hidden;
    }
    const id = `${prefix}-${key}`.replace(/[^\w-]/g, '_');
    const row = el(doc, f.type === 'list' ? 'div' : 'label', 'story-suite-row');
    row.dataset.field = key;
    row.dataset.type = f.type;
    if (f.type !== 'list') row.setAttribute('for', id);
    const text = el(doc, 'span', 'story-suite-row-label');
    const name = el(doc, 'b', '', f.label ?? humanize(key));
    name.id = `${id}-label`;
    text.appendChild(name);
    if (f.help) text.appendChild(el(doc, 'small', '', f.help));
    const note = f.type === 'profile' ? profileNote(doc, value) : null;
    if (note) text.appendChild(note);
    row.appendChild(text);
    const input = control(doc, f, value, readOnly ? () => {} : onChange, id, memo);
    (input.focusTarget ?? input).id = id;
    if (f.type === 'list') input.setAttribute('aria-labelledby', name.id);
    row.appendChild(input);
    if (readOnly) {
        row.classList.add('story-suite-row-readonly');
        row.dataset.readonly = 'true';
        for (const node of [input, ...input.querySelectorAll('input, select, textarea, button')]) {
            node.disabled = true;
            node.setAttribute('aria-disabled', 'true');
        }
    }
    return row;
}
