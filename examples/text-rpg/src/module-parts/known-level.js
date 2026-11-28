// The level the world already gives a person who joins as a companion: their NPC State dossier's, else their world pack cast entry's.
// Only for a reply with the core rule mark `companionKnownLevel`; a reply with no mark joins at the level the narrator's line says.
// Both are read through queries: `people.list` / `people.dossier` answer from the stored people slice alone (never `npc.dossier`, which reads
// NPC State's live runtime), and the level chosen is kept on the member, so a rebuild reads no query.

const keyOf = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
// (a query nobody answers refuses the command unless caught: with no NPC State or no packs, nobody is known)
const ask = (ctx, name, args) => { try { return ctx.query(name, args); } catch { return null; } };
const levelIn = entry => (Number.isInteger(entry?.level) && entry.level >= 1 ? entry.level : null);

// The rows called `key`, then those with it as an alias.
function called(rows, key) {
    const list = (Array.isArray(rows) ? rows : []).filter(Boolean);
    return [
        list.filter(row => keyOf(row.name) === key),
        list.filter(row => Array.isArray(row.aliases) && row.aliases.some(alias => keyOf(alias) === key)),
    ];
}

// One tier's answer: { found } when nobody in it is called so; else the one level they agree on (null: no level, or namesakes who differ).
function tierLevel(rows, levelFrom) {
    if (!rows.length) return { found: false, level: null };
    const levels = [...new Set(rows.map(levelFrom).filter(level => level !== null))];
    return { found: true, level: levels.length === 1 ? levels[0] : null };
}

/**
 * The known level of the person `name`, or null: the narrator's level is then used. Own names first (the dossier's, then the pack's), and only
 * when nobody is called so, an alias (the dossier's, then the pack's): a name that is someone's own never borrows another person's level through
 * an alias. The first tier that has anyone answers, a level or nothing (a dossier with no level still lets the pack's entry of the same name answer).
 */
export function knownLevel(ctx, name) {
    const key = keyOf(name);
    if (!key || ctx.carrier?.rules?.includes('companionKnownLevel') !== true) return null;
    const people = ask(ctx, 'people.list', {}), cast = ask(ctx, 'packs.content', { kind: 'cast' });
    const fromDossier = row => levelIn(ask(ctx, 'people.dossier', { id: row.id }));
    const [ownPeople, aliasPeople] = called(people, key), [ownCast, aliasCast] = called(cast, key);
    for (const pair of [[[ownPeople, fromDossier], [ownCast, levelIn]], [[aliasPeople, fromDossier], [aliasCast, levelIn]]]) {
        const answers = pair.map(([rows, from]) => tierLevel(rows, from));
        if (!answers.some(answer => answer.found)) continue;
        return answers.find(answer => answer.level !== null)?.level ?? null;
    }
    return null;
}
