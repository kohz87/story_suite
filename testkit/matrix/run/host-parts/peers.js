// Peer query stand-ins for the matrix runner: the query names a peer answers and a stand-in that answers badly.

import { MODULES } from '../../modules.js';

const PEER_QUERIES = { sd: ['director.time', 'director.threads'], nsd: ['npc.present', 'npc.dossier'] };

function queryNames(env, key) {
    try {
        const def = env.loaded[key].make({ sdk: null });
        const names = Object.keys(def.queries ?? {});
        if (names.length) return names;
    } catch { /* falls back below */ }
    return PEER_QUERIES[key];
}

/** A stand-in for a peer module: its real query names, each answering badly (`mode`). */
function hostilePeer(env, key, mode, tally) {
    const answer = {
        throws: () => { throw new Error('matrix: the peer query failed'); },
        null: () => null,
        garbage: () => ({ api: 99, enabled: 'yes', clock: [], tiers: 7, minutes: 'soon' }),
    }[mode];
    return {
        id: MODULES[key].id,
        name: `${MODULES[key].label} (matrix stand-in)`,
        version: '0.0.0',
        queries: Object.fromEntries(queryNames(env, key).map(name => [name, (...args) => { tally.asked += 1; return answer(...args); }])),
    };
}

export { queryNames, hostilePeer };
