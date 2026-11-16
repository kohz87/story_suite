// Minting a fresh record ID from the receipt's rng. Pure.

/**
 * A fresh `<prefix>_<8 base36>` ID drawn from the receipt's rng, so a handler stays
 * deterministic (§3.2: ctx.rng is the only randomness). `taken(id)` says an ID is in use.
 */
export function newId(ctx, prefix, taken) {
    for (let attempt = 0; attempt < 64; attempt += 1) {
        let id = `${prefix}_`;
        for (let i = 0; i < 8; i += 1) id += Math.floor(ctx.rng() * 36).toString(36);
        if (!taken(id)) return id;
    }
    return ctx.fail('FAILED', 'No free ID could be found for a new record.');
}
