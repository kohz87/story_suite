// Small helpers every command shares: asking another module, naming the angler, and making ids from a receipt.

// An id for a record made by this receipt: the receipt's own random part under our prefix, so it is
// unique, well formed and the same on every replay (handlers have no sdk.id).
export const idFrom = (prefix, receiptId) => `${prefix}_${String(receiptId).split('_').pop()}`;

// A query another module may not have registered: null instead of a throw.
export function maybeQuery(ctx, name, args) {
    try {
        return ctx.query?.(name, args) ?? null;
    } catch {
        return null;
    }
}

// Who is fishing: a main character supplied by another module, else "The party".
export function anglerName(ctx) {
    let pc = maybeQuery(ctx, 'party.pc');
    if (typeof pc === 'string') pc = maybeQuery(ctx, 'party.actor', { id: pc });
    const name = typeof pc?.name === 'string' ? pc.name.trim() : '';
    return name || 'The party';
}
