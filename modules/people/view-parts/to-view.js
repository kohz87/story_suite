// A sidecar state to the people slice (view.js): records keyed by id in order, social owners resolved to ids, and the cache's people the store lacks carried. Pure.

import { isPlain, list, stripVolatile } from './volatile.js';
import { fileRefs, noBytes } from './bytes.js';

// A name or id in `socialGraph.unresolved[].ownerId` becomes the person's npc_ id (found by id, name or alias) or '' (the store refuses anything else for the whole write).
const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;

function ownerIds(graph, records) {
    if (!isPlain(graph) || !Array.isArray(graph.unresolved)) return graph;
    const find = text => {
        const wanted = String(text ?? '').trim().toLowerCase();
        const hit = wanted ? records.find(r => isPlain(r) && (String(r.id ?? '').toLowerCase() === wanted || String(r.name ?? '').toLowerCase() === wanted || (Array.isArray(r.aliases) && r.aliases.some(a => String(a).trim().toLowerCase() === wanted)))) : null;
        return hit && PEOPLE_ID.test(String(hit.id)) ? hit.id : '';
    };
    const unresolved = graph.unresolved.map(slot => (isPlain(slot) && slot.ownerId !== undefined && slot.ownerId !== null && slot.ownerId !== '' && !PEOPLE_ID.test(String(slot.ownerId)) ? { ...slot, ownerId: find(slot.ownerId) } : slot));
    return { ...graph, unresolved };
}

/** The cache's people the store's keys lack (by id), added to the keys: a change made before the first hydrate is not thrown away by it. */
export function peopleCarry(keys, state) {
    if (!isPlain(keys) || !isPlain(state) || !Array.isArray(state.npcs)) return keys;
    const have = new Set(list(keys.npcs).map(record => record?.id));
    const extra = state.npcs.filter(record => isPlain(record) && typeof record.id === 'string' && !have.has(record.id));
    return extra.length ? { ...keys, npcs: [...list(keys.npcs), ...structuredClone(extra)] } : keys;
}

// state -> { v, order, npcs, ...} or null (with a warning) when an id is missing or repeated.
export function peopleView(state, { warn = () => {} } = {}) {
    if (!isPlain(state)) { warn('people view: no state'); return null; }
    const order = [];
    const npcs = {};
    for (const record of list(state.npcs)) {
        const id = isPlain(record) && typeof record.id === 'string' ? record.id : '';
        if (!id) { warn('people view: a record has no id'); return null; }
        if (Object.prototype.hasOwnProperty.call(npcs, id)) { warn(`people view: duplicate id ${id}`); return null; }
        order.push(id);
        npcs[id] = noBytes(stripVolatile(record));
    }
    return {
        v: 1,
        order,
        npcs,
        candidates: noBytes(stripVolatile(list(state.candidates))),
        dismissed: noBytes(stripVolatile(list(state.dismissed))),
        userDismissedGroups: noBytes(stripVolatile(list(state.userDismissedGroups))),
        socialGraph: ownerIds(noBytes(stripVolatile(isPlain(state.socialGraph) ? state.socialGraph : {})), list(state.npcs)),
        portraitAssets: fileRefs(noBytes(stripVolatile(isPlain(state.portraitAssets) ? state.portraitAssets : {}))),
        turn: Number.isFinite(state.turn) ? state.turn : 0,
    };
}
