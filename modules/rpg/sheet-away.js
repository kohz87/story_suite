// Where a companion the story has away has gone, for the `rpg.sheet` rows (Party sheet note and chip): read from Story Director's `director.away.view`, so it is the
// same words as the World screen. A pure read: nothing is stored here. (The Party tab shows it only while Settings → RPG "Companions who are away wait" is on: ui/select/build.js.)
import { fold } from './read.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** `{ [folded name]: { where, lastSeen, short } }` of the people away now; {} when Story Director has no such query. `tools`: the query's tools (`query`). */
export function awayNow(tools) {
    try {
        const view = typeof tools?.query === 'function' ? tools.query('director.away.view', {}) : null;
        const rows = Array.isArray(view?.people) ? view.people.filter(row => isRecord(row) && row.away === true && typeof row.name === 'string') : [];
        return Object.fromEntries(rows.map(row => [fold(row.name), {
            where: String(row.doing || 'Away'), lastSeen: String(row.newsAgo || 'when they left'), short: row.due ? 'due back' : row.back ? `back ${row.back}` : 'away',
        }]));
    } catch { return {}; }
}

/** The member's `away` field: the entry for their name (or null). */
export const sheetAway = (gone, name) => gone[fold(name)] ?? null;
