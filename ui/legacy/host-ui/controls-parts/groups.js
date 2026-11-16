// A module's schema fields sorted into settings groups, by a field's group or its label's prefix.

import { normalizeField } from '../../../../core/registry.js';
import { SETTINGS_TEXT } from '../text.js';

// "Calendar: Era (written before the year)" → group "Calendar", label "Era (…)". The part before the
// first ": " is a group only when it is short and has no brackets ("Money scale (0: the pack's)" has none).
const LABEL_PREFIX = /^([^:()[\]{}]{1,48}?):\s+(\S[\s\S]*)$/;

/**
 * A schema's fields in settings groups, in the order they first appear: [{ name, fields: [{ key, field }] }].
 * A field's group is its `group` (text), else its label's prefix ("Calendar: Era" → "Calendar", the label
 * then "Era"), else General. A label that starts with its own `group` loses that prefix too.
 */
export function groupFields(schema) {
    const groups = new Map();
    for (const [key, raw] of Object.entries(schema ?? {})) {
        const field = normalizeField(raw);
        const label = typeof field?.label === 'string' ? field.label.trim() : null;
        const match = label ? LABEL_PREFIX.exec(label) : null;
        const given = typeof field?.group === 'string' ? field.group.trim() : '';
        let name = SETTINGS_TEXT.general;
        let shown = label;
        if (given) {
            name = given;
            if (match && match[1].trim().toLowerCase() === given.toLowerCase()) shown = match[2];
        } else if (match) {
            name = match[1].trim();
            shown = match[2];
        }
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push({ key, field: shown === label ? raw : { ...field, label: shown } });
    }
    return [...groups].map(([name, fields]) => ({ name, fields }));
}
