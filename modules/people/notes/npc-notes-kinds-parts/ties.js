// The Ties rows for a bond list, folding tie keys under aliases, and who owes whom.
import { npcKey } from '../../meters/npc-meters-config.js';
import { TIE_TAGS, tiesView, tagsFromRelation, owedBy } from '../npc-notes-ties.js';

/**
 * The Ties rows for a person's bond list (bond strings "Name — relation | dynamic"): the stored tags, and for a bond with none the
 * tags its relation word implies (read-time only, never stored; `derived: true`). `owedByKeys`: owedBy(key, everyone's ties).
 */
export function tieRows(ties, bonds, owedByKeys = []) {
    const rows = tiesView(ties, bonds, owedByKeys);
    const have = new Set(rows.map(row => row.key));
    for (const entry of Array.isArray(bonds) ? bonds : []) {
        const [head, relation = ''] = String(entry ?? '').split(/\s+[—-]\s+/, 2);
        const name = head.split('|')[0].trim();
        const key = npcKey(name);
        const tags = key && !have.has(key) ? tagsFromRelation(relation.split('|')[0]) : [];
        if (!tags.length) continue;
        have.add(key);
        rows.push({ key, name, tags, owes: tags.includes('owes'), owedBy: false, derived: true });
    }
    return rows;
}

export { owedBy };

/**
 * Folds tie keys written under an alias into the person's own key (an alias merge in Delta leaves the slice's keys as they were):
 * `canon` maps an alias's key to the key of the name it now answers to. Tags of keys that meet are joined, in the canonical order.
 */
export function foldTies(ties, canon = {}) {
    const out = {};
    for (const [key, tags] of Object.entries(ties && typeof ties === 'object' ? ties : {})) {
        const to = Object.hasOwn(canon, key) ? canon[key] : key;
        out[to] = [...new Set([...(out[to] ?? []), ...(Array.isArray(tags) ? tags : [])])];
    }
    for (const [key, tags] of Object.entries(out)) out[key] = TIE_TAGS.filter(tag => tags.includes(tag));
    return out;
}

/** { aliasKey: nameKey } for Delta's dossiers (`npcs`: [{ name, aliases }]), for foldTies. */
export function aliasCanon(npcs) {
    const out = {};
    for (const npc of Array.isArray(npcs) ? npcs : []) {
        const to = npcKey(npc?.name);
        if (!to) continue;
        for (const alias of Array.isArray(npc.aliases) ? npc.aliases : []) {
            const key = npcKey(alias);
            if (key && key !== to && !Object.hasOwn(out, key)) out[key] = to;
        }
    }
    return out;
}
