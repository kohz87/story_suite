// The format 3 names of a cast entry (an entry without `kind`): `about`, `fields` and the home base taken from `start.place`.
// Read only until the format 3 removal (pack format 4, job X1); a format 4 world cast entry carries `kind` and uses the new names.

import { FIELDS_MAX, FIELD_NAME_MAX, FIELD_VALUE_MAX } from './limits-fields.js';
import { clip, isObject } from './shared-text.js';

/** True for a format 3 entry (no `kind`). */
export const isLegacyEntry = raw => !(typeof raw?.kind === 'string' && raw.kind);

/** The format 3 `fields` ({ name: value } or [{ name, value }]) cleaned: at most 12, names unique without regard to case. */
export function legacyFields(raw) {
    const entries = Array.isArray(raw) ? raw.map(item => [item?.name ?? item?.field, item?.value]) : Object.entries(isObject(raw) ? raw : {});
    const out = {};
    for (const [key, value] of entries) {
        const name = clip(key, FIELD_NAME_MAX);
        const text = clip(typeof value === 'number' ? String(value) : value, FIELD_VALUE_MAX);
        if (!name || !text || Object.keys(out).some(other => other.toLowerCase() === name.toLowerCase())) continue;
        out[name] = text;
        if (Object.keys(out).length >= FIELDS_MAX) break;
    }
    return out;
}
