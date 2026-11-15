// Story Director v2, retry ledger: allocates a fresh write id from the command seed.

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

/** A fresh `<prefix>_xxxxxxxx` id from the command's seed (no Math.random), not in `taken`. */
export function idFrom(ctx, prefix, taken) {
    for (let tries = 0; tries < 64; tries += 1) {
        let id = '';
        for (let i = 0; i < 8; i += 1) id += ID_CHARS[Math.floor(ctx.rng() * ID_CHARS.length) % ID_CHARS.length];
        id = `${prefix}_${id}`;
        if (!Object.hasOwn(taken, id)) return id;
    }
    throw new Error(`No free ${prefix} id.`);
}
