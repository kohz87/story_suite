// Story Director v2, part **cast**: querying atlas travel times, known roads, and party goal links.

import { flat } from '../domain.js';
import { orderedThreads } from '../../tracker/convert.js';
import { ask } from './query.js';

/** `(from, to)` → days of travel by the atlas's trip (`atlas.travel`), or null when nothing says. */
export const travelOf = query => (from, to) => {
    const trip = ask(query, 'atlas.travel', { from, to }, null);
    return Number.isFinite(trip?.days) ? trip.days : null;
};

/** The same by known roads only (the reach rule's, world.js `reachDays`): a trip the atlas estimated from map coordinates (`source: 'map'`) is null. */
export const roadsOf = query => (from, to) => {
    const trip = ask(query, 'atlas.travel', { from, to }, null);
    return trip?.source === 'routes' && Number.isFinite(trip.days) ? trip.days : null;
};

/** What can really link a goal to the party (world.js `linkOf`): the open threads (a secret never counts) and the names of what the party carries. */
export function linksOf(query, state) {
    const rows = ask(query, 'inventory.items', { owner: 'party' }, []);
    return {
        threads: orderedThreads(state?.domains?.director).filter(thread => thread.status === 'active' && thread.kind !== 'secret').map(thread => ({ key: thread.key, fields: thread.fields ?? {} })),
        items: (Array.isArray(rows) ? rows : []).map(row => flat(row?.name)).filter(Boolean),
    };
}
