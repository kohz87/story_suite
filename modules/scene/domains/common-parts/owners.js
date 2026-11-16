// Owner display names (state or handler ctx) and the sentence-start capital. Pure.

/** An owner's display name: "the party", an actor's name from the party domain, or the ID. */
export function ownerName(state, owner) {
    if (owner === 'party') return 'the party';
    const name = state?.domains?.party?.actors?.[owner]?.name;
    return typeof name === 'string' && name.trim() ? name.trim() : owner;
}

/** The same, read through a handler ctx (the party domain may not exist). */
export function ownerNameIn(ctx, owner) {
    if (owner === 'party') return 'the party';
    let party = null;
    try {
        party = ctx.read('party');
    } catch {
        party = null;
    }
    return ownerName({ domains: { party } }, owner);
}

// "the party" starts a sentence as "The party"; names and IDs are left as they are.
export const capitalize = text => (text.startsWith('the ') ? `T${text.slice(1)}` : text);
