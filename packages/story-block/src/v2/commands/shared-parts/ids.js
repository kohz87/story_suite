// ID making for the command bus: the prefix pattern, the base36 alphabet, the id stream seed and newId.
export const ID_PREFIX = /^[a-z][a-z0-9]*$/;
export const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';
// Mixed into the receipt's seed for ctx.id's own stream (any odd constant; fixed, so IDs replay).
export const ID_STREAM = 0x5bd1e995;

/** `<prefix>_<8 base36>` from crypto (SPEC §2.1), for receipt IDs when no `id` option is given. */
export function newId(prefix, cryptoApi = globalThis.crypto) {
    if (typeof cryptoApi?.getRandomValues !== 'function') throw new Error('This browser has no crypto random source for IDs.');
    const chars = [];
    const bytes = new Uint8Array(16);
    while (chars.length < 8) {
        cryptoApi.getRandomValues(bytes);
        // 252 = 7 × 36: bytes at or above it are thrown away so every character is equally likely.
        for (const byte of bytes) if (byte < 252 && chars.length < 8) chars.push((byte % 36).toString(36));
    }
    return `${prefix}_${chars.join('')}`;
}
