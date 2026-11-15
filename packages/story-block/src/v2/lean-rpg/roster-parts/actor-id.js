// Works out an actor id from a Character block's module id.
const BASE = 36 ** 8;

// (a 52-bit string hash, two 32-bit lanes mixed; spread well enough that a handful of blocks never meet)
function hash52(text) {
    let a = 0xdeadbeef, b = 0x41c6ce57;
    for (let at = 0; at < text.length; at += 1) {
        const code = text.charCodeAt(at);
        a = Math.imul(a ^ code, 2654435761);
        b = Math.imul(b ^ code, 1597334677);
    }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
    b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
    return 4294967296 * (2097151 & b) + (a >>> 0);
}

/** The actor id of the Character block `module` (its data-module id): `ac_` and 8 base-36 characters, the same whatever the person is called. */
export const actorIdOf = module => `ac_${(hash52(String(module ?? '')) % BASE).toString(36).padStart(8, '0')}`;
