// The living cast and the story's own moves (switch story-director.world-events; spec v0.14.7 §8 Latest base wins, rulings 36-37).
// After a reply's lines, for each pack person with an NPC State dossier (`castFrom.key`): the narrator's `~ npc … | where:` changed
// the dossier's place → a story base there; they left the party (`party.levels` marks them left) → a stays record at the party's
// place ("waits for You at <place>"); they rejoined → their base is cleared (they travel with You). What was last seen (the dossier
// place, whether they had left) is kept in the `told` slot, so only a change counts; the first sight is only noted. Pure.

import { isRecord, slotOf } from '../domain.js';

const low = text => String(text ?? '').trim().toLowerCase();

/** The dossiers made from the pack, by cast key: `{ [key]: { where } }`. */
function dossiers(npcs) {
    const out = {};
    for (const id of Object.keys(isRecord(npcs) ? npcs : {}).sort()) {
        const npc = npcs[id];
        const key = npc?.castFrom?.key;
        if (typeof key === 'string' && !(key in out)) out[key] = { where: typeof npc.location === 'string' ? npc.location.trim() : '' };
    }
    return out;
}

/** Whether the party lists the person (by name or alias), and whether they have left: true / false, or null (not in the party). */
function leftOf(person, party) {
    const names = new Set([person.name, ...(Array.isArray(person.aliases) ? person.aliases : [])].map(low).filter(Boolean));
    const member = (Array.isArray(party) ? party : []).find(item => names.has(low(item?.name)));
    return member ? member.left === true : null;
}

/**
 * The `cast.story` payload for the reply: `{ set: [{ key, at, by, routine }], clear: [key], told: [{ key, where, left }] }`, or null
 * when nothing changed. `slice` the cast store, `npcs` NPC State's dossiers, `party` `party.levels`, `place` the party's place.
 */
export function storyBases(slice, { npcs = {}, party = [], place = '' } = {}) {
    const people = isRecord(slice?.people) ? slice.people : {};
    const made = dossiers(npcs);
    const out = { set: [], clear: [], told: [] };
    for (const key of Object.keys(people).sort()) {
        const person = people[key];
        if (!isRecord(person) || person.alive === false || !made[key]) continue;
        const where = made[key].where;
        const left = leftOf(person, party);
        const told = slotOf(person.told);
        if (told && told.where === where && told.left === left) continue;
        out.told.push({ key, where, left });
        if (!told) continue;
        const base = slotOf(person.base);
        if (where && low(where) !== low(told.where)) out.set.push({ key, at: where, by: 'story', routine: `staying at ${where}` });
        else if (left === true && told.left === false && place) out.set.push({ key, at: place, by: 'stays', routine: `waits for You at ${place}` });
        else if (left === false && told.left === true && base) out.clear.push(key);
    }
    return out.set.length || out.clear.length || out.told.length ? out : null;
}
