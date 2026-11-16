// The id a checkpoint has, derived from its hash.

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/** The id a checkpoint with this hash has: `nk_` and eight base36 characters of the hash. */
export function checkpointIdOf(hash) {
    let value = BigInt(`0x${String(hash).slice(0, 12)}`);
    let text = '';
    for (let i = 0; i < 8; i += 1) {
        text = BASE36[Number(value % 36n)] + text;
        value /= 36n;
    }
    return `nk_${text}`;
}
