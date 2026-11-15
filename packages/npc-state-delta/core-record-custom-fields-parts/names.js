/* Custom-field name and value normalization: the configured names, the stored values, and the values read for a dossier. */
import { cleanText } from '../core-text.js';

// User-defined dossier fields (for example Level or Class), named once in settings for every chat.
export const CUSTOM_FIELD_LIMIT = 6;
const CUSTOM_FIELD_STORED_LIMIT = 12;
const CUSTOM_FIELD_NAME_MAX = 40;
const CUSTOM_FIELD_VALUE_MAX = 60;

export function normalizeCustomFieldNames(value) {
    const items = Array.isArray(value) ? value : String(value ?? '').split(/[,\n]/);
    const names = [];
    for (const item of items) {
        const name = cleanText(String(item ?? '').replace(/["{}:]/g, ' '), CUSTOM_FIELD_NAME_MAX);
        if (name && !names.some(other => other.toLowerCase() === name.toLowerCase())) names.push(name);
    }
    return names.slice(0, CUSTOM_FIELD_LIMIT);
}

export function normalizeCustomFields(raw) {
    const entries = Array.isArray(raw)
        ? raw.map(item => [item?.name ?? item?.field, item?.value])
        : Object.entries(raw && typeof raw === 'object' ? raw : {});
    const out = {};
    for (const [key, value] of entries) {
        const name = cleanText(key, CUSTOM_FIELD_NAME_MAX);
        const text = cleanText(typeof value === 'number' ? String(value) : value, CUSTOM_FIELD_VALUE_MAX);
        if (!name || !text || Object.keys(out).some(other => other.toLowerCase() === name.toLowerCase())) continue;
        out[name] = text;
        if (Object.keys(out).length >= CUSTOM_FIELD_STORED_LIMIT) break;
    }
    return out;
}

// The stored values of the configured fields, keyed by the configured spelling.
export function customFieldValues(npc = {}, names = []) {
    const stored = normalizeCustomFields(npc?.customFields);
    const out = {};
    for (const name of normalizeCustomFieldNames(names)) {
        const key = Object.keys(stored).find(other => other.toLowerCase() === name.toLowerCase());
        if (key) out[name] = stored[key];
    }
    return out;
}
