// Story Suite v2: every cast person's name and alias the story knows (packs, NPC State, the cast store), for the
// prose-only edit check (edit-words.js). Asked at an edit only; a query that is missing or throws gives nothing, and a name list
// that cannot be built at all makes the edit take the full path.

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** `castNames(view)` → string[] (names and aliases, as written). */
export function castNames(view) {
    const out = [];
    const take = person => {
        if (typeof person === 'string') { out.push(person); return; }
        if (!record(person)) return;
        if (typeof person.name === 'string') out.push(person.name);
        for (const alias of Array.isArray(person.aliases) ? person.aliases : []) if (typeof alias === 'string') out.push(alias);
    };
    const ask = (name, args = {}) => {
        try { return typeof view?.query === 'function' ? view.query(name, args) : null; } catch { return null; }
    };
    const list = value => (Array.isArray(value) ? value : []);
    list(ask('packs.content', { kind: 'cast' })).forEach(take);
    list(ask('director.cast')).forEach(take);
    for (const known of list(ask('npc.known'))) {
        take(known);
        const name = typeof known === 'string' ? known : known?.name;
        if (typeof name === 'string') take(ask('npc.dossier', { name }));
    }
    const domains = view?.state?.domains;
    for (const person of Object.values(record(domains?.cast?.people) ? domains.cast.people : {})) take(person);
    return out;
}
