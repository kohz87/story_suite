// The ripples table: no pack carries one any more (format 4 has no `ripples` field), so Story Director's hidden sway falls back to its authored choice.

/** The ripples table of the first enabled pack: always null (nothing writes one). Kept so Story Director's `packs.ripples` query still answers. */
export function ripplesOf() {
    return null;
}

/**
 * The `packs.rippleChoice` answer: null for a malformed ask, else the authored `fallback`, because no pack holds a table to choose from.
 * (The checks on `pack`, `ids`, `pick` and `fallback` are the ones the table read had, so a malformed ask is still null.)
 */
export function rippleChoice(packs, args = {}) {
    const { pack, ids, pick = 'top', fallback = null } = args ?? {};
    if (typeof pack !== 'string' || !pack) return null;
    const wanted = typeof ids === 'string' ? ids.split(',').map(id => id.trim()) : [];
    if (!wanted.length || new Set(wanted).size !== wanted.length || !['top', 'bottom'].includes(pick)) return null;
    return fallback;
}
