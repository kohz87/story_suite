// A world cast entry's story lists, cleaned for the person record: abilities and keepsakes, appearance forms, key relationships and ties.

import { BUILT_IN_LIMITS, normalizeStoryList } from '../../core/core-record-parts/built-in-fields.js';
import { clip, isObject } from './shared-text.js';

const TIE_TAGS = Object.freeze(['kin', 'partner', 'friend', 'ally', 'mentor', 'serves', 'rival', 'enemy', 'owes']);

/** Abilities or keepsakes as `{ list, extra }`: the first `max` rows kept (names unique without regard to case) and `extra`, the names of the valid rows after the limit that were left out. */
export function castPairs(raw, max) {
    const all = normalizeStoryList(raw, BUILT_IN_LIMITS.abilities + 1000);
    return { list: all.slice(0, max), extra: all.slice(max).map(row => row.name) };
}

/** The pack's forms `[{ name, look }]` as the record's appearance forms `[{ name, appearance }]`, at most six. */
export function castForms(raw) {
    const out = [];
    for (const item of Array.isArray(raw) ? raw : []) {
        const name = clip(isObject(item) ? item.name : '', 120);
        const appearance = clip(isObject(item) ? item.look : '', 600);
        if (name && appearance && out.length < 6 && !out.some(row => row.name.toLowerCase() === name.toLowerCase())) out.push({ name, appearance });
    }
    return out;
}

/**
 * The people the entry names, by cast id, as the person's names: `keyRelationships` ["Name — text"] (at most eight) and `ties` [{ name, tag }].
 * `nameOf(id)` gives the name of a cast id or '' (a person not met yet: Story Director's answer names only the met). Those rows are kept by id in
 * `pending` ({ keyRelationships: [{ id, text }], ties: [{ id, tag }] }, at most eight and twelve), never by name: cast-links.js resolves them once
 * that person is met.
 */
export function castLinks(entry, nameOf) {
    const keyRelationships = [];
    const pending = { keyRelationships: [], ties: [] };
    for (const item of Array.isArray(entry?.keyRelationships) ? entry.keyRelationships : []) {
        const id = isObject(item) ? clip(item.id, 80) : '';
        const name = id ? clip(nameOf?.(id), 120) : '';
        const text = clip(isObject(item) ? item.text : '', 400);
        if (!text || keyRelationships.length + pending.keyRelationships.length >= 8) continue;
        if (name) keyRelationships.push(`${name} — ${text}`);
        else if (id && nameOf) pending.keyRelationships.push({ id, text });
    }
    const ties = [];
    for (const item of Array.isArray(entry?.ties) ? entry.ties : []) {
        const id = isObject(item) ? clip(item.with, 80) : '';
        const name = id ? clip(nameOf?.(id), 120) : '';
        if (!TIE_TAGS.includes(item?.tag)) continue;
        if (name) { if (!ties.some(row => row.name === name && row.tag === item.tag)) ties.push({ name, tag: item.tag }); }
        else if (id && nameOf && pending.ties.length < 12 && !pending.ties.some(row => row.id === id && row.tag === item.tag)) pending.ties.push({ id, tag: item.tag });
    }
    return { keyRelationships, ties, pending };
}
