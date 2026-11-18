// A cast dossier's ties and key relationships to people not met when it was made (`castFrom.links`, by cast id only, never shown or injected),
// named at read once that person is met. Pure and worked out from the dossiers alone: a person is met once a dossier carries their cast key,
// so a swipe, a rewind, a middle delete or a reload shows exactly what the head holds. Nothing is written back.

import { isObject } from './shared-text.js';

const KEY_RELATIONSHIPS_MAX = 8;   // core-keyrel KEY_RELATIONSHIP_LIMIT
const nameOfLine = line => String(line ?? '').split(/\s+[—-]\s+|\s*\|/)[0].trim().toLowerCase();

/** The met cast people's names by cast key ("pack:id"): every dossier made from the cast (`castFrom.key`) and its current name. */
export function metCastNames(npcs) {
    const out = new Map();
    for (const npc of Array.isArray(npcs) ? npcs : []) {
        const key = isObject(npc?.castFrom) && typeof npc.castFrom.key === 'string' ? npc.castFrom.key : '';
        const name = typeof npc?.name === 'string' ? npc.name.trim() : '';
        if (key && name && !out.has(key)) out.set(key, name);
    }
    return out;
}

/**
 * The person's waiting links whose person `met` (metCastNames) names: { keyRelationships: ["Name — text"], ties: [{ name, tag }] }. A key relationship
 * to someone the person's own list already names is left out, and the own list plus these stay within eight. Empty lists without `castFrom.links`.
 */
export function castLinksNamed(npc, met) {
    const links = isObject(npc?.castFrom?.links) ? npc.castFrom.links : null;
    const pack = typeof npc?.castFrom?.pack === 'string' ? npc.castFrom.pack : '';
    const out = { keyRelationships: [], ties: [] };
    if (!links || !pack || !(met instanceof Map)) return out;
    const own = Array.isArray(npc.keyRelationships) ? npc.keyRelationships : [];
    const named = new Set(own.map(nameOfLine));
    for (const row of Array.isArray(links.keyRelationships) ? links.keyRelationships : []) {
        const name = isObject(row) ? met.get(`${pack}:${row.id}`) : null;
        const text = typeof row?.text === 'string' ? row.text.trim() : '';
        if (!name || !text || named.has(name.toLowerCase()) || own.length + out.keyRelationships.length >= KEY_RELATIONSHIPS_MAX) continue;
        named.add(name.toLowerCase());
        out.keyRelationships.push(`${name} — ${text}`);
    }
    for (const row of Array.isArray(links.ties) ? links.ties : []) {
        const name = isObject(row) ? met.get(`${pack}:${row.with ?? row.id}`) : null;
        if (name && typeof row.tag === 'string' && !out.ties.some(tie => tie.name === name && tie.tag === row.tag)) out.ties.push({ name, tag: row.tag });
    }
    return out;
}

/** `npcs` with each person's met waiting key relationships after their own (a new object only for a person who gains one); the input is not changed. */
export function withCastLinks(npcs) {
    if (!Array.isArray(npcs)) return npcs;
    if (!npcs.some(npc => isObject(npc?.castFrom?.links))) return npcs;
    const met = metCastNames(npcs);
    return npcs.map(npc => {
        const added = castLinksNamed(npc, met).keyRelationships;
        return added.length ? { ...npc, keyRelationships: [...(Array.isArray(npc.keyRelationships) ? npc.keyRelationships : []), ...added] } : npc;
    });
}
