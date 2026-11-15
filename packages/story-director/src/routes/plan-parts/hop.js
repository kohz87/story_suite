// Computes single-hop travel days, transfer modes, and best edges between places.

import { tidy } from '../util.js';
import { TRANSFER_KM, TRANSFER_MODES } from '../pack.js';
import { paceFor } from './pace.js';
import { boardDays, legDays } from './days.js';

function edgePace(pack, edge, mode) {
    return paceFor(pack, edge.code, mode, { corridor: edge.corridor });
}

// The mode a hop goes by: the trip's own, or for public transport in a modern pack a short
// transfer (a taxi to the airport). Null when nothing can.
export function hopMode(pack, edge, mode, transfer) {
    if (edgePace(pack, edge, mode)) return mode;
    if (!transfer || edge.km > TRANSFER_KM) return null;
    return TRANSFER_MODES.find(other => edgePace(pack, edge, other)) ?? null;
}

// One hop's time in days: the road at the mode's pace, plus boarding when the mode rides it.
export function hopDays(pack, edge, mode, rate = null) {
    const pace = rate ?? edgePace(pack, edge, mode)?.rate;
    const days = legDays(edge.km, pace, pack.rules);
    return days === null ? null : tidy(days + boardDays(pack, edge.code));
}

export function bestEdge(pack, edges, mode) {
    let best = null;
    for (const edge of edges) {
        const pace = edgePace(pack, edge, mode);
        if (!pace) continue;
        const days = legDays(edge.km, pace.rate, pack.rules);
        if (!best || days < best.days || (days === best.days && edge.km < best.edge.km)) best = { edge, days };
    }
    return best?.edge ?? null;
}
