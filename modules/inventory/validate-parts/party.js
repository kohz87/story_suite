// Reads the party's members and its main character for the wear rules and the load, and names an owner, someone who left too.

import { isPlainObject, OWNER_RE } from '../../scene/domains/common.js';
import { trimText } from '../../scene/names.js';
import { asking } from './shared-asking.js';
import { STRINGS } from '../../../core/strings.js';

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

// What an owner is called, someone who left too: the party domain's name, else a member list's (`party.actors`; `party.levels`, which the RPG answers with
// those who left; `party.names`, a module's own list of everyone it ever had), else "Someone who left": never the ID of someone who left. A member the party
// still lists without a name is called as membersOf calls them (the ID).
export function holderName(query, party, id) {
    if (id === 'party') return 'the party';
    const told = name => (typeof name === 'string' && name.trim() ? trimText(name, 60) : null);
    const own = told(party?.actors?.[id]?.name);
    if (own) return own;
    for (const list of ['party.actors', 'party.levels', 'party.names']) {
        const rows = asking(query, list, {});
        const found = told(Array.isArray(rows) ? rows.find(row => row?.id === id)?.name : null);
        if (found) return found;
    }
    if (membersOf(query, party).some(member => member.id === id)) return id;
    // (with no party module answering there is no one to have left: a plain word, still never the ID)
    return party || Array.isArray(asking(query, 'party.actors', {})) ? STRINGS.inventory.gear.someoneLeft : STRINGS.inventory.gear.someoneHolding;
}

// The same, for a command's summary (the party domain may not exist).
export function ownerSaid(ctx, id) {
    let party = null;
    try { party = ctx.read('party'); } catch { party = null; }
    return holderName((name, args) => ctx.query(name, args), party, id);
}
