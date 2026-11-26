// Who a name means, for the holding's posts, read from the state alone (so a replay answers the same): the person's NPC State dossier and
// the cast's record of them, by an exact name first and else by an alias only one person has. A shared first name alone never makes two
// names one person. Pure.
import { fold, readSheet } from '../../rpg/read.js';
import { isMet } from '../../cast/cast/domain.js';

const namesOf = record => [record?.name, ...(Array.isArray(record?.aliases) ? record.aliases : [])].filter(name => typeof name === 'string' && name.trim()).map(fold);

// One entry a person: a dossier made from a cast record is joined with it.
function people(state) {
    const cast = state?.domains?.cast?.people ?? {}, joined = new Set();
    const out = Object.values(state?.domains?.people?.npcs ?? {}).map(dossier => {
        const key = dossier?.castFrom?.key, record = key && Object.hasOwn(cast, key) ? cast[key] : null;
        if (record) joined.add(key);
        return { name: fold(dossier?.name ?? ''), names: [...namesOf(dossier), ...namesOf(record)], dead: dossier?.lifeState === 'deceased' || record?.alive === false };
    });
    for (const [key, record] of Object.entries(cast)) {
        if (!joined.has(key) && isMet(record)) out.push({ name: fold(record.name ?? ''), names: namesOf(record), dead: record.alive === false });
    }
    return out;
}

// The one person the name means, or null: nobody, or more than one.
function find(list, name) {
    const wanted = fold(name);
    const exact = list.filter(person => person.name === wanted);
    const hits = exact.length ? exact : list.filter(person => person.names.includes(wanted));
    return hits.length === 1 ? hits[0] : null;
}

/** A command's prefix with the two records names are matched in, which the data modules' own reading of it leaves out. */
export function withPeople(ctx, prefix) {
    const read = domain => { try { return ctx.read(domain); } catch { return null; } };
    return { ...prefix, domains: { ...prefix.domains, people: read('people'), cast: read('cast') } };
}

/** Whether two names are one person: the same name, or two names of the same record. */
export function samePerson(state, one, other) {
    if (fold(one) === fold(other)) return true;
    const list = people(state), first = find(list, one);
    return first !== null && first === find(list, other);
}

/** Whether the person is a party member who has not left: they travel with You. */
export function travels(state, name) {
    return readSheet(state, { withLeft: true }).characters.some(member => !member.left && samePerson(state, member.who, name));
}

/** Whether the story records the person of that name as dead. */
export const isDead = (state, name) => find(people(state), name)?.dead === true;
