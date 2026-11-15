// Record check, revision helper, and deterministic ID generation for atlas entities.

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The revision this command commits as (MODULES §F2 `ctx.rev`), 0 when the host does not say. */
export const revOf = ctx => (Number.isSafeInteger(ctx?.rev) ? ctx.rev : 0);

/** A fresh `<prefix>_xxxxxxxx` id from the command's seed (no Math.random), not in `taken`. */
export function newId(ctx, prefix, taken) {
    for (let tries = 0; tries < 64; tries += 1) {
        let id = '';
        for (let i = 0; i < 8; i += 1) id += ID_CHARS[Math.floor(ctx.rng() * ID_CHARS.length) % ID_CHARS.length];
        id = `${prefix}_${id}`;
        if (!Object.hasOwn(taken, id)) return id;
    }
    throw new Error(`No free ${prefix} id.`);
}
