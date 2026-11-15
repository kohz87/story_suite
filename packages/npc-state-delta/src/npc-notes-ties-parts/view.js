// The dossier view of ties: who owes a person and the tie rows for the people in a bond list.
import { clean } from '../npc-meters-config.js';
import { ordered } from './shared-tags.js';
import { NAME_MAX, keyOf, readTiesObject } from './shared-object.js';

/** The keys of the people who owe `selfKey`: `others` maps an owner's key to that owner's ties object (or null). Sorted. */
export function owedBy(selfKey, others) {
    const owners = [];
    for (const [owner, ties] of Object.entries(others ?? {})) {
        if (owner !== selfKey && Array.isArray(ties?.[selfKey]) && ties[selfKey].includes('owes')) owners.push(owner);
    }
    return owners.sort();
}

/**
 * Dossier rows for the people in a bond list (bond strings "Name — relation | dynamic", or bare names), in bond order: only people
 * with a tag or an owed-by line, never anyone outside the list. Each row: { key, name, tags, owes, owedBy }. `owedByKeys` comes from owedBy.
 */
export function tiesView(ties, bonds, owedByKeys = []) {
    const base = readTiesObject(ties);
    const rows = [];
    const seen = new Set();
    for (const entry of Array.isArray(bonds) ? bonds : []) {
        const name = clean(String(entry ?? '').split(/\s+[—-]\s+|\s*\|/)[0], NAME_MAX);
        const key = keyOf(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const tags = ordered(base[key] ?? []);
        const owed = owedByKeys.includes(key);
        if (!tags.length && !owed) continue;
        rows.push({ key, name, tags, owes: tags.includes('owes'), owedBy: owed });
    }
    return rows;
}
