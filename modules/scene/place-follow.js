// Who came along keeps up (SFF4 #5): a `~ place` move's `with:` companions are at the new place, so the people store's dossier of each (NPC State's
// `location`, the "Right now" and "last known place" rows) is set to it in the reply's own step. Left behind later, their last known place is where
// they were left. A party member is not followed here (the party travels with You; leaving the party records where they stay), nor anyone whose
// dossier already names this place or a place inside it (or the place it is inside). Only on a reply marked `placeFromMap` (the move's own map rule), so a
// reply written before that rule writes what it wrote on Re-read. Without the people store (NPC State off) nothing happens.
import { foldKey } from '../../core/text.js';

const ask = (ctx, name, args = {}) => { try { return ctx.query(name, args); } catch { return null; } };
const namesOf = row => [row?.name, ...(Array.isArray(row?.aliases) ? row.aliases : [])].map(name => foldKey(String(name ?? ''))).filter(Boolean);
// The same place, or one inside the other ("Highmark Capital" and "Highmark Capital / Crown Keep").
const samePlace = (a, b) => { const x = foldKey(a), y = foldKey(b); return x === y || x.startsWith(`${y} / `) || y.startsWith(`${x} / `); };

/** Sets the dossier `location` of each companion in `names` (as written on the line) to `place`. */
export function followPlace(ctx, names, place) {
    const people = ask(ctx, 'people.list', {});
    if (!Array.isArray(people) || !people.length || !place) return;
    const party = ask(ctx, 'party.actors', {});
    const inParty = new Set((Array.isArray(party) ? party : []).flatMap(namesOf));
    for (const name of names) {
        const key = foldKey(name);
        const row = people.find(item => namesOf(item).includes(key));
        if (!row || typeof row.id !== 'string' || row.lifeState === 'deceased' || namesOf(row).some(each => inParty.has(each))) continue;
        if (row.location && samePlace(row.location, place)) continue;
        try { ctx.call('people.fields', { id: row.id, fields: { location: place } }); } catch { /* a dossier the store will not write: the move stands */ }
    }
}
