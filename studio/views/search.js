// Search across the open pack: records whose title, id, name or keys hold the words, as rows that open the record.

import { h } from '../../ui/kit/dom.js';

const MAX = 50;
const textOf = record => (record && typeof record === 'object'
    ? [record.title, record.name, record.id, record.slug, record.template, ...(Array.isArray(record.keys) ? record.keys : []), ...(Array.isArray(record.aliases) ? record.aliases : [])]
    : [record]).filter(value => typeof value === 'string' || typeof value === 'number').map(String);

/** The hits for `query` in `parts` (from parts.js partsOf): `[{ part, rec, label, where }]`, at most 50. */
export function searchParts(parts, query) {
    const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const hits = [];
    for (const part of parts) {
        if (part.always) continue;
        if (words.every(word => part.name.toLowerCase().includes(word))) hits.push({ part: part.id, rec: null, label: part.name, where: 'Part' });
        for (const section of part.sections) {
            if (!Array.isArray(section.value)) continue;
            section.value.forEach((record, index) => {
                const text = textOf(record);
                if (hits.length < MAX && words.every(word => text.some(item => item.toLowerCase().includes(word)))) {
                    hits.push({ part: part.id, rec: `${section.key}.${index}`, label: text[0] ?? `#${index + 1}`, where: `${part.name} · ${section.key}` });
                }
            });
        }
    }
    return hits.slice(0, MAX);
}

/** The hits as page nodes; `onGo(partId, rec)` opens one. */
export function renderSearch(hits, query, onGo) {
    if (!hits.length) return [h('p', { class: 'fine' }, `Nothing in this pack matches “${query}”.`)];
    return [h('div', { class: 'sresults' }, hits.map(hit => h('button', { type: 'button', class: 'hitrow', onClick: () => onGo(hit.part, hit.rec) }, h('b', hit.label), h('small', hit.where))))];
}
