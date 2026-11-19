// A stand-in for NPC State's queries for Story Director tests (names, the delete fuzz): the people it tracks and the archived ones.

/** A stand-in's stable identity for a name: np_ and eight letters from it. */
const idOf = name => `np_${Array.from(String(name).toLowerCase().replace(/[^a-z0-9]/g, '')).concat(...'00000000').slice(0, 8).join('')}`;

/**
 * NPC State's queries as a test module: `people` is `{ name: { id?, aliases?, lifeState?, role? } }`, those it tracks that are not
 * archived (`npc.known`); `npc.dossier` finds them by name, alias or id; `npc.identity` gives `{ id, name }`. `archived` is
 * `{ name: { id?, lifeState? } }`: dossiers archived since, which still answer `npc.dossier { id }` with `archived: true` (and
 * `lifeState: 'deceased'` for a confirmed death), as the real Delta does; by name they answer nothing. Both may change between replies (a rename moves an entry, keeping its id).
 */
export function fakeDelta(people = {}, archived = {}) {
    const entryOf = name => {
        const want = String(name ?? '').toLowerCase();
        return Object.keys(people).find(key => key.toLowerCase() === want || (people[key]?.aliases ?? []).some(alias => alias.toLowerCase() === want)) ?? null;
    };
    const idFor = (name, entry) => entry?.id ?? idOf(name);
    const byId = id => Object.keys(people).find(key => idFor(key, people[key]) === id) ?? null;
    const dossier = (name, entry, archivedFlag = false) => ({ name, aliases: entry.aliases ?? [], role: entry.role ?? '', lifeState: entry.lifeState ?? 'unknown', archived: archivedFlag });
    return {
        id: 'npc-state-delta',
        name: 'NPC State (test stand-in)',
        version: '0.0.0-test',
        domains: {},
        commands: {},
        queries: {
            'npc.known': () => Object.keys(people),
            'npc.present': () => [],
            'npc.dossier': (_state, { name, id } = {}) => {
                if (id !== undefined) {
                    const key = byId(id);
                    if (key) return dossier(key, people[key]);
                    const gone = Object.keys(archived).find(other => idFor(other, archived[other]) === id);
                    return gone ? dossier(gone, archived[gone], true) : null;
                }
                const key = entryOf(name);
                return key ? dossier(key, people[key]) : null;
            },
            'npc.identity': (_state, { name, id } = {}) => {
                const key = id !== undefined ? byId(id) : entryOf(name);
                return key ? { id: idFor(key, people[key]), name: key } : null;
            },
            'npc.meters': () => null,
        },
    };
}
