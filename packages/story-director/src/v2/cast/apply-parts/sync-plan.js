// Plans cast pack sync additions, updates, and drops.

import { MAX_DOING, MAX_PEOPLE, cutWords, isInt, isMet, isRecord, slotOf, tables } from '../domain.js';

const sameAliases = (a, b) => (Array.isArray(a) ? a : []).join('\u0001') === (Array.isArray(b) ? b : []).join('\u0001');

/**
 * What the packs' cast asks of the world now: `{ add: [entry], update: [{ key, ver, name, aliases }], drop: [key], init, updated:
 * [{ pack, n, changed, from, to }] }`, all empty when nothing is to be done. `cast` is `castOf(query)` (entries.js).
 */
export function planSync(slice, cast, { now = null } = {}) {
    const { people } = tables(slice);
    const out = { add: [], update: [], drop: [], init: false, updated: [], changed: new Set() };
    if (!cast?.listed) return out;
    let room = MAX_PEOPLE - Object.keys(people).length;
    for (const entry of cast.entries) {
        const person = Object.hasOwn(people, entry.key) && isRecord(people[entry.key]) ? people[entry.key] : null;
        if (!person) {
            if (room > 0) {
                out.add.push(entry);
                room -= 1;
            }
            continue;
        }
        // A met person keeps the words they were met with: only the version and fingerprint they were last seen at move on. A version bump
        // alone is no change: what the entry says is (its fingerprint; a person kept before fingerprints existed has it noted silently).
        const edited = Boolean(entry.sig) && Boolean(person.sig) && person.sig !== entry.sig;
        const noted = Boolean(entry.sig) && person.sig !== entry.sig;
        if (person.ver !== entry.ver || noted || (!isMet(person) && (person.name !== entry.name || !sameAliases(person.aliases, entry.aliases)))) {
            out.update.push({ key: entry.key, ver: entry.ver, ...(entry.sig ? { sig: entry.sig } : {}), name: entry.name, aliases: [...entry.aliases] });
            if (!isMet(person) && (edited || person.name !== entry.name || !sameAliases(person.aliases, entry.aliases))) out.changed.add(entry.key);
        }
    }
    for (const [key, person] of Object.entries(people)) {
        if (!isRecord(person) || isMet(person) || cast.byKey.has(key) || !cast.enabled.has(person.pack)) continue;
        out.drop.push(key);
    }
    out.init = isInt(now) && !slotOf(slice?.day) && (cast.entries.length > 0 || Object.keys(people).length > 0);
    // A pack the chat already had people from, now with people it did not have: the first reply after says so (no names).
    const packs = [...new Set(out.add.map(entry => entry.pack))];
    for (const pack of packs) {
        const had = Object.values(people).filter(person => isRecord(person) && person.pack === pack);
        if (!had.length) continue;
        out.updated.push({
            pack, n: out.add.filter(entry => entry.pack === pack).length,
            changed: [...out.changed].filter(key => key.startsWith(`${pack}:`)).length,
            from: had[0].ver, to: cast.packs?.[pack]?.version ?? '',
        });
    }
    return out;
}

/** Whether a sync plan asks for nothing. */
export const syncEmpty = plan => !plan.add.length && !plan.update.length && !plan.drop.length && !plan.init;

/** The payload of `cast.sync` for a plan (what the step needs, no pack text beyond a person's start). */
export const syncPayload = plan => ({
    ...(plan.add.length ? { add: plan.add.map(entry => ({ pack: entry.pack, id: entry.id, name: entry.name, ...(entry.aliases.length ? { aliases: entry.aliases } : {}), ver: entry.ver, ...(entry.sig ? { sig: entry.sig } : {}), place: entry.place, doing: cutWords(entry.routine || entry.goal, MAX_DOING) })) } : {}),
    ...(plan.update.length ? { update: plan.update } : {}),
    ...(plan.drop.length ? { drop: plan.drop } : {}),
    ...(plan.updated.length ? { updated: plan.updated.map(item => ({ pack: item.pack, n: item.n, changed: item.changed, from: item.from, to: item.to })) } : {}),
    ...(plan.init ? { init: true, first: true } : {}),
});
