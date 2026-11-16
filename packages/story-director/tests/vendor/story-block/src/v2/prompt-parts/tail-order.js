// Story Suite v2: the fixed order modules' tail text goes in, and sorting contexts by it.

export const TAIL_ORDER = Object.freeze(['scene', 'inventory', 'party', 'combat', 'trade', 'director']);

// Where a module's tail goes: by the earliest fixed-order domain it owns, else after them.
function rank(context) {
    const ranks = context.domains.map(domain => TAIL_ORDER.indexOf(domain)).filter(index => index >= 0);
    return ranks.length ? Math.min(...ranks) : TAIL_ORDER.length;
}

/** The modules' contexts in tail order (fixed domains first, then by id). */
export function tailOrder(contexts) {
    return [...contexts].sort((a, b) => rank(a) - rank(b) || (a.moduleId < b.moduleId ? -1 : a.moduleId > b.moduleId ? 1 : 0));
}
