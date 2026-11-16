// Resolving an np_ id or a name to the active dossier.

import { NP_ID, nameKey, isRecord } from './shared-basics.js';

const NAME_MAX = 80;

const nameOf = npc => String(npc?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

/**
 * `npc.identity({ id } | { name })`: exactly one selector. → { id, nativeKey, name } | null. `npcs`: the live dossiers.
 * Unknown, ambiguous, archived, malformed or both selectors: null.
 */
export function resolveIdentity(identity, npcs, args) {
    if (!isRecord(args)) return null;
    const hasId = args.id !== undefined && args.id !== null;
    const hasName = args.name !== undefined && args.name !== null;
    if (hasId === hasName) return null;
    const list = Array.isArray(npcs) ? npcs.filter(npc => isRecord(npc) && typeof npc.id === 'string') : [];
    const found = nativeKey => list.find(npc => npc.id === nativeKey) ?? null;
    if (hasId) {
        if (typeof args.id !== 'string' || !NP_ID.test(args.id)) return null;
        const entry = identity?.map?.[args.id];
        const npc = entry && !entry.archived ? found(entry.nativeKey) : null;
        return npc ? { id: args.id, nativeKey: npc.id, name: nameOf(npc) } : null;
    }
    if (typeof args.name !== 'string') return null;
    const want = nameKey(args.name);
    if (!want) return null;
    const hits = list.filter(npc => nameKey(npc.id) === want || nameKey(npc.name) === want || (Array.isArray(npc.aliases) && npc.aliases.some(alias => nameKey(alias) === want)));
    if (hits.length !== 1) return null;
    const id = identity?.byKey?.[hits[0].id];
    return id ? { id, nativeKey: hits[0].id, name: nameOf(hits[0]) } : null;
}
