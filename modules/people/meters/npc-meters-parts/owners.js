// The one rule for which meters entry is a person's: every stored dossier's id and name (alive, dead or archived) belongs to that dossier alone.
import { findNpcKey } from '../npc-meters-slice.js';
import { isObject, npcKey } from '../npc-meters-config.js';

const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;

/**
 * The owners among the stored dossiers: `people` is the people domain's `npcs` ({ [id]: record }) or `people.list`'s rows. Built once per call; the
 * name index is made on first need.
 *   has(id)       a stored dossier has this id
 *   ids()         every stored id
 *   record(id)    that dossier ({ ...record, id }) or null
 *   named(label)  the dossiers whose own name this is (any case)
 *   entryKey(npcs, person, asked?) → the key of `person`'s ({ id?, name, aliases? }) entry in `npcs`, or null; `person.labels` is not read.
 *     Their own id first; else an entry under a key that is nobody else's id, found by their name, then `asked` and their aliases (labels(person, asked)).
 */
export function ownersOf(people) {
    const byId = Array.isArray(people)
        ? Object.fromEntries(people.filter(row => typeof row?.id === 'string').map(row => [row.id, row]))
        : isObject(people) ? people : {};
    const has = id => Object.hasOwn(byId, id) && isObject(byId[id]);
    const record = id => (typeof id === 'string' && has(id) ? { ...byId[id], id } : null);
    let names = null;
    const index = () => {
        if (names) return names;
        names = new Map();
        for (const id of Object.keys(byId)) {
            const key = has(id) ? npcKey(byId[id].name) : null;
            if (key) names.set(key, [...(names.get(key) ?? []), id]);
        }
        return names;
    };
    const named = label => (index().get(npcKey(label)) ?? []).map(record);
    // A person's name, then the other labels that may be matched: never another dossier's name, never another dossier's id.
    const labels = (person, asked = []) => {
        const own = npcKey(person?.name);
        const others = [...asked, ...(Array.isArray(person?.aliases) ? person.aliases : [])].filter(label => {
            if (typeof label !== 'string' || !label) return false;
            if (PEOPLE_ID.test(label) && label !== person?.id && has(label)) return false;
            const key = npcKey(label);
            return key === own || !index().has(key);
        });
        return [person?.name, ...others].filter(label => typeof label === 'string' && label);
    };
    const entryKey = (npcs, person, asked = []) => {
        const id = typeof person?.id === 'string' && PEOPLE_ID.test(person.id) ? person.id : null;
        if (id && isObject(npcs) && Object.hasOwn(npcs, id)) return id;
        // A holder without an id (a name alone) is the stored dossier of that name, when there is one.
        if (!id) {
            const stored = named(person?.name);
            const mine = stored.find(item => isObject(npcs) && Object.hasOwn(npcs, item.id));
            if (mine) return mine.id;
        }
        return findNpcKey(npcs, labels(person, asked), { has: key => key !== id && has(key) });
    };
    return { has, ids: () => Object.keys(byId).filter(has), record, named, labels, entryKey };
}
