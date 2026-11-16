/* NPC State Delta tie bookkeeping: recording which ties a reply mentioned, the notes' tie tag lookup and cleaning a stored tieSeen. */
import { normalizeName } from '../../core-text.js';
import { KEY_RELATIONSHIP_LIMIT, tieParts } from './entries.js';
import { tiesTracked } from './tie-rows.js';

/**
 * `tieSeen` after a reply on story `day`: each tie whose person `text` (the reply prose) or `named` (names in tie lines) mentions is marked `day`.
 * A mention is the whole name or one of that person's known aliases (`roster`: tieRoster of the cast) as whole words; never a first word or a title
 * ("the harbour captain" is not Captain Vane).
 */
export function recordTieMentions(npc, { day, text = '', named = [], roster = null } = {}) {
    if (!npc || !Number.isInteger(day)) return undefined;
    const hay = ` ${normalizeName(text)} `;
    const tied = new Set((Array.isArray(named) ? named : []).map(entry => normalizeName(tieParts(entry).name)));
    const next = { ...(tiesTracked(npc) ? npc.tieSeen : {}) };
    for (const entry of Array.isArray(npc.keyRelationships) ? npc.keyRelationships : []) {
        const key = normalizeName(tieParts(entry).name);
        if (!key) continue;
        const labels = [key, ...(roster?.labels?.get(roster.get(key)) || [])];
        if (tied.has(key) || labels.some(label => label && hay.includes(` ${label} `))) next[key] = Math.max(day, Number.isInteger(next[key]) ? next[key] : day);
    }
    for (const key of Object.keys(next)) if (!(npc.keyRelationships || []).some(entry => normalizeName(tieParts(entry).name) === key)) delete next[key];
    return tiesTracked(npc) || Object.keys(next).length ? next : undefined;
}

/** The `tags(name)` lookup for readTieRows from the notes' tie rows ([{ name, tags, owedBy }]): a set tag wins; a person who owes this one is a debt tie (Owes). */
export function noteTieTags(rows) {
    const byName = new Map((Array.isArray(rows) ? rows : []).map(row => [String(row?.name ?? '').toLowerCase(), row?.tags?.length ? row.tags : (row?.owedBy ? ['owes'] : [])]));
    return name => byName.get(String(name).toLowerCase()) ?? [];
}

/** A stored `tieSeen` cleaned: at most KEY_RELATIONSHIP_LIMIT people, each a whole story day >= 0; undefined when it is not an object. */
export function cleanTieSeen(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const out = {};
    for (const [key, day] of Object.entries(value).slice(0, KEY_RELATIONSHIP_LIMIT)) {
        if (key && key.length <= 160 && Number.isInteger(day) && day >= 0) out[key] = day;
    }
    return out;
}
