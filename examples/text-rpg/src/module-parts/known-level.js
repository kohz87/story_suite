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

// A name beats an alias. Two people under the same one with different levels say nothing.
function agreed(rows, key, levelFrom) {
    for (const tier of called(rows, key)) {
        const levels = [...new Set(tier.map(levelFrom).filter(level => level !== null))];
        if (levels.length) return levels.length === 1 ? levels[0] : null;
    }
    return null;
}

/** The known level of the person `name`, or null: the narrator's level is then used. */
export function knownLevel(ctx, name) {
    const key = keyOf(name);
    if (!key || ctx.carrier?.rules?.includes('companionKnownLevel') !== true) return null;
    return agreed(ask(ctx, 'people.list', {}), key, row => levelIn(ask(ctx, 'people.dossier', { id: row.id })))
        ?? agreed(ask(ctx, 'packs.content', { kind: 'cast' }), key, levelIn);
}
