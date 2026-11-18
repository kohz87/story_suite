// Who came along keeps up (SFF4 #5): a `~ place` move's `with:` companions are at the new place, so the people store's dossier of each (NPC State's
// `location`, the "Right now" and "last known place" rows) is set to it in the reply's own step. Left behind later, their last known place is where
// they were left. A party member is not followed here (the party travels with You; leaving the party records where they stay), nor anyone whose
// dossier already names this place or a place inside it (or the place it is inside). Only on a reply marked `placeFromMap` (the move's own map rule), so a
// reply written before that rule writes what it wrote on Re-read. Without the people store (NPC State off) nothing happens.
// Left behind (S2PA B12): whoever the scene had who did not come along gets the place they were left at (leavePlace), unless their dossier already names it
// or a place inside it; a person whose place was cleared when they came into the scene would otherwise have no place at all once the scene moves on.
import { foldKey } from '../../core/text.js';

const ask = (ctx, name, args = {}) => { try { return ctx.query(name, args); } catch { return null; } };
const namesOf = row => [row?.name, ...(Array.isArray(row?.aliases) ? row.aliases : [])].map(name => foldKey(String(name ?? ''))).filter(Boolean);
// The same place, or one inside the other ("Highmark Capital" and "Highmark Capital / Crown Keep").
const samePlace = (a, b) => { const x = foldKey(a), y = foldKey(b); return x === y || x.startsWith(`${y} / `) || y.startsWith(`${x} / `); };

const storedPlace = (ctx, id) => { try { const value = ctx.read('people')?.npcs?.[id]?.location; return typeof value === 'string' ? value : null; } catch { return null; } };

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
        // The stored place: people.list does not show it for someone the scene has here (SFP1 F7), and every companion is.
        const stored = storedPlace(ctx, row.id) ?? row.location;
        if (stored && samePlace(stored, place)) continue;
        try { ctx.call('people.fields', { id: row.id, fields: { location: place } }); } catch { /* a dossier the store will not write: the move stands */ }
    }
}

/** Sets the dossier `location` of each person in `names` (the scene's people who did not come along) to `place`, the place the scene moved away from. */
export function leavePlace(ctx, names, place) {
    const people = ask(ctx, 'people.list', {});
    if (!Array.isArray(people) || !people.length || !place) return;
    const party = ask(ctx, 'party.actors', {});
    const inParty = new Set((Array.isArray(party) ? party : []).flatMap(namesOf));
    const at = foldKey(place);
    for (const name of names) {
        const key = foldKey(name);
        const row = people.find(item => namesOf(item).includes(key));
        if (!row || typeof row.id !== 'string' || row.lifeState === 'deceased' || namesOf(row).some(each => inParty.has(each))) continue;
        // Only a place that says less than this one is replaced: the same place, or one inside it, is kept as written.
        const stored = foldKey(storedPlace(ctx, row.id) ?? '');
        if (stored && (stored === at || stored.startsWith(`${at} / `))) continue;
        try { ctx.call('people.fields', { id: row.id, fields: { location: place } }); } catch { /* a dossier the store will not write: the move stands */ }
    }
}
