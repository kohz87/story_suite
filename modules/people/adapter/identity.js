// The `npc.identity` query and the empty catch-up, with no timeline participant behind them (the store is the one timeline). `npc.identity` names a person
// by an `np_` id that is derived from the dossier's own id (`npc_<slug>`), so it is the same after a reload, a swipe or a rewind and is never written
// anywhere. Story Director and the host's native-death route ask it; unknown, ambiguous or malformed is null (see resolveIdentity).

import { sha256 } from '../legacy/storysuite-participant/hash.js';
import { resolveIdentity } from '../legacy/storysuite-participant/identity.js';

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/** The `np_` id of a dossier id: `np_` and 8 base-36 characters of its hash. */
export function npIdOf(nativeKey) {
    let value = BigInt(`0x${sha256(`np\u0000${nativeKey}`).slice(0, 12)}`);
    let text = '';
    for (let i = 0; i < 8; i += 1) { text = BASE36[Number(value % 36n)] + text; value /= 36n; }
    return `np_${text}`;
}

/** { readState() → the cache's state | null } → { queries, catchUp }: `catchUp` is the idle shape the cast views and the generation gate read. */
export function createIdentity({ readState }) {
    const identityOf = npcs => {
        const identity = { map: {}, byKey: {} };
        for (const npc of npcs) {
            if (typeof npc?.id !== 'string') continue;
            const id = npIdOf(npc.id);
            if (Object.hasOwn(identity.map, id)) continue;
            identity.map[id] = { nativeKey: npc.id, archived: false };
            identity.byKey[npc.id] = id;
        }
        return identity;
    };
    const queries = {
        'npc.catchUp': () => null,
        'npc.identity': (_state, args) => {
            let npcs = null;
            try { npcs = readState()?.npcs; } catch { npcs = null; }
            return Array.isArray(npcs) ? resolveIdentity(identityOf(npcs), npcs, args) : null;
        },
    };
    const catchUp = { status: () => null, canGenerate: () => true, dismiss: () => {}, resume: async () => {}, skip: async () => ({ ok: true }), rebuild: async () => ({ ok: false }), restored: () => {} };
    return { queries, catchUp };
}
