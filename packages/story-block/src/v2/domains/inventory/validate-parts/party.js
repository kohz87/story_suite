// Reads the party's members and its main character for the wear rules.

import { isPlainObject, OWNER_RE } from '../../common.js';
import { trimText } from '../../names.js';
import { asking } from './shared-asking.js';

// The party's members, in the party module's order: `party.actors` when a module answers it, else the
// `party` domain's actors (its `order` first). → [{ id, name }]
export function membersOf(query, party) {
    const listed = asking(query, 'party.actors', {});
    const raw = Array.isArray(listed)
        ? listed
        : [...(Array.isArray(party?.order) ? party.order : []), ...Object.keys(isPlainObject(party?.actors) ? party.actors : {}).sort()]
            .filter((id, at, all) => all.indexOf(id) === at && isPlainObject(party.actors[id]))
            .map(id => ({ ...party.actors[id], id }));
    const seen = new Set();
    return raw.filter(actor => typeof actor?.id === 'string' && OWNER_RE.test(actor.id) && actor.id !== 'party' && !seen.has(actor.id) && seen.add(actor.id))
        .map(actor => ({ id: actor.id, name: trimText(typeof actor.name === 'string' && actor.name.trim() ? actor.name : actor.id, 60) }));
}

// The main character's id (`party.pc`, else the party domain's `pc`), or null: what the shared bag wears
// is theirs when a party module identifies them.
export function pcOf(query, party) {
    const pc = asking(query, 'party.pc', {});
    const id = typeof pc?.id === 'string' ? pc.id : typeof party?.pc === 'string' ? party.pc : null;
    return id && OWNER_RE.test(id) && id !== 'party' ? id : null;
}
