// The world the Chronicle already holds (open events and factions with stance), as told to the safety net.

import { clip } from './shared-text.js';
import { NAME_CHARS } from './near.js';

// How many open world events and factions the extractor is told, and the longest stance told.
export const MAX_WORLD = 10;
export const STANCE_CHARS = 40;

/**
 * The world the Chronicle already holds, for the safety net's world and faction lines: `{ events, factions }`; the names of
 * the open world events (query rows `{ name }`) and the factions with their stance (`{ name, stance }`), each at most `cap`, names clipped.
 */
export function worldKnown(world, { cap = MAX_WORLD } = {}) {
    const { events = [], factions = [] } = world ?? {};
    const rows = (list, make) => (Array.isArray(list) ? list : []).filter(row => typeof row?.name === 'string' && row.name.trim()).slice(0, Math.max(0, cap)).map(make);
    return {
        events: rows(events, row => clip(row.name, NAME_CHARS)),
        factions: rows(factions, row => ({ name: clip(row.name, NAME_CHARS), stance: clip(row.stance, STANCE_CHARS) })),
    };
}
