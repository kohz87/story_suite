// The one rule for which meters entry is a person's: every stored dossier's id and name (alive, dead or archived) belongs to that dossier alone.
import { findNpcKey } from '../npc-meters-slice.js';
import { isObject, npcKey } from '../npc-meters-config.js';
import { isTerminalNpcDeath } from '../../core/terminal-lifecycle.js';

const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;

/**
 * The owners among the stored dossiers: `people` is the people domain's `npcs` ({ [id]: record }) or `people.list`'s rows. Built once per call; the
 * name index is made on first need.
 *   has(id)       a stored dossier has this id
 *   ids()         every stored id
 *   record(id)    that dossier ({ ...record, id }) or null
 *   named(label)  the dossiers whose own name this is (any case)
 *   aliased(label)  the dossiers that have this name as an alias
 *   entryKey(npcs, person, asked?) → the key of `person`'s ({ id?, name, aliases? }) entry in `npcs`, or null; `person.labels` is not read.
 *     Their own id first; else an entry under a key that is nobody else's id and is assigned (ownerOf) to nobody else, found by their name, then `asked`
 *     and their aliases (labels(person, asked)).
 *   sameName(a, b)  the one comparison of two names (their slugs, as entry keys are matched)
 *   ownerOf(npcs, key)  the stored dossier whose entry `key` is: the one with that id, else the one of those its name or labels reach it, a living one first, or null
 *   asking(npcs, key, labels?)  → { name, labels }: what to ask the dossier hooks (setup, notes) with for that entry: its owner's id; with no
 *     owner, the entry's name, unless a stored dossier carries that name or alias (then nothing: it is not theirs); `gone`: the owner is dead or archived
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
    // The entry `person`'s id or labels reach, whoever it is assigned to. `skip(key)`: entries that may not be matched by name.
    const claim = (npcs, person, asked = [], skip = () => false) => {
        const id = typeof person?.id === 'string' && PEOPLE_ID.test(person.id) ? person.id : null;
        if (id && isObject(npcs) && Object.hasOwn(npcs, id)) return id;
        // A holder without an id (a name alone) is the stored dossier of that name, when there is one.
        if (!id) {
            const stored = named(person?.name);
            const mine = stored.find(item => isObject(npcs) && Object.hasOwn(npcs, item.id));
            if (mine) return mine.id;
        }
        return findNpcKey(npcs, labels(person, asked), { has: key => (key !== id && has(key)) || skip(key) });
    };
    // An entry found by name is read by the one dossier it is assigned to (ownerOf): a namesake never borrows it.
    const entryKey = (npcs, person, asked = []) => claim(npcs, person, asked, key => {
        const owner = has(person?.id) ? ownerOf(npcs, key) : null;
        return Boolean(owner) && owner.id !== person.id;
    });
    const gone = item => isTerminalNpcDeath(item) || Boolean(item.archived);
    const sameName = (a, b) => npcKey(a) !== null && npcKey(a) === npcKey(b);
    const aliased = label => Object.keys(byId).filter(has).map(record).filter(item => Array.isArray(item.aliases) && item.aliases.some(alias => sameName(alias, label)));
    const ownerOf = (npcs, key) => {
        const held = record(key);
        if (held) return held;
        const entry = isObject(npcs) && Object.hasOwn(npcs, key) ? npcs[key] : null;
        if (!entry) return null;
        const mine = item => claim(npcs, item) === key;
        // (of several who reach it, a living one before a dead or archived one)
        const first = list => [...list].sort((a, b) => Number(gone(a)) - Number(gone(b))).find(mine);
        return first(named(entry.name)) ?? first(aliased(entry.name)) ?? null;
    };
    const asking = (npcs, key, given = null) => {
        const owner = ownerOf(npcs, key);
        if (owner) return { name: owner.id, labels: [owner.id], ...(gone(owner) ? { gone: true } : {}) };
        const name = npcs?.[key]?.name;
        return named(name).length || aliased(name).length ? { name: '', labels: [] } : { name, labels: given ?? [name] };
    };
    return { has, ids: () => Object.keys(byId).filter(has), record, named, aliased, labels, entryKey, sameName, ownerOf, asking };
}
