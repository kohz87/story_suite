// Assigning np_ ids to dossiers: a fresh id, and bringing an identity up to date with the dossiers.

import { sha256 } from '../../adapter/hash.js';
import { cleanIdentity } from './clean-identity.js';

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/** A fresh np_ id for a dossier: from the lineage, the native key and a counter past every id in use or ever issued. */
export function newNpId(seed, nativeKey, taken) {
    for (let n = 0; n < 10000; n += 1) {
        const hex = sha256(`${seed}\u0000${nativeKey}\u0000${n}`);
        let value = BigInt(`0x${hex.slice(0, 12)}`);
        let text = '';
        for (let i = 0; i < 8; i += 1) {
            text = BASE36[Number(value % 36n)] + text;
            value /= 36n;
        }
        const id = `np_${text}`;
        if (!taken.has(id)) return id;
    }
    throw new Error('No free np_ id.');
}

/**
 * Brings an identity up to date with the dossiers: every dossier has a live np_ (assigned in dossier order), and an entry whose dossier is
 * gone is archived. `reserved`: every id ever issued in this lineage, which is never issued again; a native key that comes back after its
 * dossier was deleted gets a new id, never the archived one.
 * → { identity, reserved, assigned: [np_], archived: [np_], changed }; the inputs are not changed.
 */
export function hydrateIdentity(identity, npcs, { seed, reserved = [] } = {}) {
    const next = cleanIdentity(identity);
    const used = new Set([...Object.keys(next.map), ...reserved]);
    const keys = new Set((Array.isArray(npcs) ? npcs : []).map(npc => (typeof npc?.id === 'string' ? npc.id : '')).filter(Boolean));
    const assigned = [];
    const archived = [];
    for (const [id, entry] of Object.entries(next.map)) {
        if (!entry.archived && !keys.has(entry.nativeKey)) {
            entry.archived = true;
            delete next.byKey[entry.nativeKey];
            archived.push(id);
        }
    }
    for (const nativeKey of keys) {
        if (Object.hasOwn(next.byKey, nativeKey)) continue;
        const id = newNpId(seed, nativeKey, used);
        used.add(id);
        next.map[id] = { nativeKey, archived: false, since: Object.keys(next.map).length + 1 };
        next.byKey[nativeKey] = id;
        assigned.push(id);
    }
    return { identity: next, reserved: [...new Set([...reserved, ...Object.keys(next.map)])].sort(), assigned, archived, changed: assigned.length > 0 || archived.length > 0 };
}
