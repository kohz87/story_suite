/* Which NPCs the relationship map shows, with their status, and the bonds between them. */
import { parseKeyRelationshipEntry, resolveNpcReference } from '../../social/social.js';
import { DESKTOP_NODE_CAP } from './span-and-caps.js';
import { lensValue } from './lenses.js';

export function mapStatus(npc = {}) {
    if (npc.bucket === 'archived') return 'archived';
    if (npc.present) return 'scene';
    if (npc.worldActive) return 'active';
    return 'away';
}

// Dead NPCs and stale removals never appear on the map; a manual archive does.
function onMap(npc) { return Boolean(npc?.id) && npc.bucket !== 'dead' && !(npc.bucket === 'archived' && npc.archiveReason === 'stale'); }

// In-chat and active NPCs are always shown; the rest are the strongest by the current lens, up to
// the cap. The selected dossier is kept on the map when it is eligible.
export function selectMapNpcs(npcs = [], { lens = 'warmth', cap = DESKTOP_NODE_CAP, selectedId = '' } = {}) {
    const eligible = npcs.filter(onMap);
    const always = eligible.filter(npc => npc.bucket !== 'archived' && (npc.present || npc.worldActive));
    const rest = eligible.filter(npc => !always.includes(npc))
        .sort((a, b) => Math.abs(lensValue(b.relationship, lens)) - Math.abs(lensValue(a.relationship, lens))
            || String(a.name).localeCompare(String(b.name)));
    const shown = [...always, ...rest.slice(0, Math.max(0, cap - always.length))];
    const selected = eligible.find(npc => npc.id === selectedId);
    if (selected && !shown.includes(selected)) shown.push(selected);
    return { shown, total: eligible.length };
}

// Important Bonds between NPCs on the map. Unresolved or off-map counterparts draw nothing.
export function resolveMapBonds(npcs = [], shownIds = new Set()) {
    const bonds = new Map();
    for (const npc of npcs) {
        if (!shownIds.has(npc.id)) continue;
        for (const entry of Array.isArray(npc.keyRelationships) ? npc.keyRelationships : []) {
            const parsed = parseKeyRelationshipEntry(entry);
            const other = parsed ? resolveNpcReference(npcs, parsed.subject) : null;
            if (!other || other.id === npc.id || !shownIds.has(other.id)) continue;
            const key = [npc.id, other.id].sort().join('|');
            const bond = bonds.get(key) || { a: [npc.id, other.id].sort()[0], b: [npc.id, other.id].sort()[1], relation: {} };
            bond.relation[npc.id] = parsed.relation;
            if (parsed.dynamic) (bond.dynamic ||= {})[npc.id] = parsed.dynamic;
            // Tie tags (ally, rival, owes) either person has toward the other, from the notes feature (npc.v2Meters.ties, by dossier id).
            const tags = Array.isArray(npc.v2Meters?.ties?.[other.id]) ? npc.v2Meters.ties[other.id] : [];
            if (tags.length) { bond.tags = [...new Set([...(bond.tags || []), ...tags])]; (bond.tagsBy ||= {})[npc.id] = tags; }
            bonds.set(key, bond);
        }
    }
    return [...bonds.values()];
}
