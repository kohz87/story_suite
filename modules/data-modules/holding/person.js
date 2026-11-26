// Who a name means, for the holding's posts, read from the state alone (so a replay answers the same): the person's NPC State dossier and
// the cast's record of them, by an exact name first and else by an alias only one person has. A shared first name alone never makes two
// names one person. Pure.
import { fold, readSheet, sameWho } from '../../rpg/read.js';
import { isMet } from '../../cast/cast/domain.js';

const namesOf = record => [record?.name, ...(Array.isArray(record?.aliases) ? record.aliases : [])].filter(name => typeof name === 'string' && name.trim()).map(fold);

// One entry a person: a dossier made from a cast record is joined with it. With no such join, the only dossier and the only cast record
// left under one name are one person too.
function people(state) {
    const cast = state?.domains?.cast?.people ?? {}, joined = new Set();
    const out = Object.values(state?.domains?.people?.npcs ?? {}).map(dossier => {
        const key = dossier?.castFrom?.key, record = key && Object.hasOwn(cast, key) ? cast[key] : null;
        if (record) joined.add(key);
        return { name: fold(dossier?.name ?? ''), names: [...namesOf(dossier), ...namesOf(record)], dead: dossier?.lifeState === 'deceased' || record?.alive === false, linked: Boolean(record) };
    });
    const free = Object.entries(cast).filter(([key, record]) => !joined.has(key) && isMet(record))
        .map(([, record]) => ({ name: fold(record.name ?? ''), names: namesOf(record), dead: record.alive === false }));
    const alone = out.filter(person => !person.linked);
    const only = (list, name) => { const hits = list.filter(person => person.name === name); return hits.length === 1 ? hits[0] : null; };
    const pairs = new Map(free.map(record => [record, record.name && only(free, record.name) ? only(alone, record.name) : null]));
    for (const [record, dossier] of pairs) {
        if (dossier) Object.assign(dossier, { names: [...dossier.names, ...record.names], dead: dossier.dead || record.dead });
        else out.push(record);
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

// A `pass` is an object one pass over the posts hands to each question, so the list is built once for it; it is not kept past the pass.
const listed = (state, pass) => (pass.list ??= people(state));

function same(state, one, other, pass) {
    if (fold(one) === fold(other)) return true;
    const list = listed(state, pass), first = find(list, one);
    return first !== null && first === find(list, other);
}

/** Whether two names are one person: the same name, or two names of the same record. */
export const samePerson = (state, one, other) => same(state, one, other, {});

/**
 * Whether the person is a party member who has not left: they travel with You. `also` (the post check only, where refusing is the safe side) are
 * the other names of their records: a member a first name of theirs means counts too, unless that member's own name is someone else's record.
 */
export function travels(state, name, { also, pass = {} } = {}) {
    const sheet = readSheet(state, { withLeft: true }).characters;
    const maybe = member => {
        const list = listed(state, pass), own = find(list, member.who);
        return (own === null || own === find(list, name)) && sameWho(member, name, also, sheet);
    };
    return sheet.some(member => !member.left && (same(state, member.who, name, pass) || (also !== undefined && maybe(member))));
}

/** Whether the story records the person of that name as dead. */
export const isDead = (state, name, pass = {}) => find(listed(state, pass), name)?.dead === true;
