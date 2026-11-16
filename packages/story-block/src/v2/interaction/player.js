// Finds the reader's own actor by the persona name rule and supplies the default one-actor roster.

const fold = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\-‐‑–—]+/gu, '');
const personaOf = persona => {
    try { return String(persona ?? '').replace(/\s+/g, ' ').trim(); } catch { return ''; }
};

/** Whether a name is the reader's own, by the host's persona rule. */
export function isReader(name, persona) {
    const who = personaOf(persona);
    return Boolean(who) && fold(name) === fold(who);
}

/** The actor the core supplies when a kind does not define `actors`. */
export function defaultActors(persona) {
    return [{ id: 'player', name: personaOf(persona), party: true, player: true }];
}

/** Marks exactly the actor whose name matches the persona; a missing roster gets the default actor. */
export function markPlayer(actors, persona) {
    const list = Array.isArray(actors) ? actors : defaultActors(persona);
    let marked = false;
    return list.filter(actor => actor && typeof actor === 'object').map(actor => {
        const copy = { ...actor };
        delete copy.player;
        if (!marked && isReader(copy.name, persona)) {
            copy.player = true;
            marked = true;
        }
        return copy;
    });
}

/** The marked player actor, or null. */
export function playerOf(actors) {
    return Array.isArray(actors) ? actors.find(actor => actor?.player === true) ?? null : null;
}
