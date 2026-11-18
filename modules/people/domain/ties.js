// The ties the story's `~ tie Name | with: Other | tag: +friend` lines stored (each person's meter entry, `bonds.npcs[id].ties`: { otherKey: [tags] }),
// read as the social graph's edges and as dossier tie lines (SOAKPEOPLE F10: they were stored but the map and the dossier read only the scan's graph).
// Pure over the stored slice, derived at read time and never stored, so a swipe, a delete, a rewind or a reload answers what the head holds.
import { npcKey } from '../meters/npc-meters-config.js';
import { readTies } from '../notes/npc-notes-ties.js';

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// The stored person a tie key names: the id itself, else the one active person whose name or alias makes that key.
function personOf(people, ids, key) {
    if (ids.includes(key)) return key;
    const hits = ids.filter(id => [people.npcs[id].name, ...(Array.isArray(people.npcs[id].aliases) ? people.npcs[id].aliases : [])].some(label => npcKey(label) === key));
    return hits.length === 1 ? hits[0] : null;
}

/** [{ aId, bId, tags }] for every stored tie between two active people (`ids`), in id order. */
export function storedTies(people, ids) {
    const out = [];
    for (const id of ids) {
        const ties = readTies(people.bonds?.npcs?.[id]?.ties);
        for (const [key, tags] of Object.entries(isObject(ties) ? ties : {})) {
            const other = personOf(people, ids, key);
            if (other && other !== id && tags.length) out.push({ aId: id, bId: other, tags });
        }
    }
    return out;
}

/** The social graph's edges with the stored ties joined in: a pair the graph lacks is added; a graph edge with no words for that direction gets the tags. */
export function edgesWithTies(edges, people, ids) {
    const out = edges.map(edge => ({ ...edge }));
    for (const tie of storedTies(people, ids)) {
        const words = tie.tags.join(', ');
        const same = out.find(edge => edge.aId === tie.aId && edge.bId === tie.bId);
        const back = out.find(edge => edge.aId === tie.bId && edge.bId === tie.aId);
        if (same) { if (!same.aToB) same.aToB = words; } else if (back) { if (!back.bToA) back.bToA = words; } else out.push({ aId: tie.aId, bId: tie.bId, aToB: words, bToA: '' });
    }
    return out;
}

/** A person's stored ties as dossier tie lines ("Name — friend, ally"), leaving out anyone `have` (key relationship lines) already names. */
export function tieLines(people, ids, id, have = []) {
    const named = new Set(have.map(line => npcKey(String(line ?? '').split(/\s+[—-]\s+/, 1)[0])).filter(Boolean));
    return storedTies(people, ids).filter(tie => tie.aId === id && !named.has(npcKey(people.npcs[tie.bId].name)))
        .map(tie => `${people.npcs[tie.bId].name} — ${tie.tags.join(', ')}`);
}
