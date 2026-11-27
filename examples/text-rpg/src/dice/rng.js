// Provides deterministic seeded randomness for the text RPG's reply dice.
// Adapted from core/commands/rng.js (keep in step when that file changes).

const UINT32_MAX = 0xFFFFFFFF;

/** True for a whole number from 0 to 2^32 - 1. */
export function isSeed(value) {
    return Number.isInteger(value) && value >= 0 && value <= UINT32_MAX;
}

// splitmix32: spreads one 32-bit seed over sfc32's four words, so seeds 1 and 2 start far apart.
function splitmix32(state) {
    let x = state | 0;
    return () => {
        x = (x + 0x9E3779B9) | 0;
        let z = x;
        z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B);
        z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35);
        return (z ^ (z >>> 16)) >>> 0;
    };
}

/** rng(seed) → () => float in [0, 1): sfc32, seeded from one uint32; a bad seed safely uses 0. */
export function rng(seedValue) {
    const expand = splitmix32(isSeed(seedValue) ? seedValue : 0);
    let a = expand(), b = expand(), c = expand(), d = expand();
    const next = () => {
        const t = (((a + b) | 0) + d) | 0;
        d = (d + 1) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
    };
    // Throw away the first outputs so the four words are well mixed before the first roll.
    for (let i = 0; i < 12; i++) next();
    return next;
}
