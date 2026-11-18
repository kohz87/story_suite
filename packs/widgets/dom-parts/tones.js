// Picks the allowed widget tone for a value and puts its class on a node.

/** Tones a widget accepts; anything else is shown as `neutral` (data never picks an arbitrary class). */
export const TONES = Object.freeze(['neutral', 'accent', 'good', 'warn', 'bad', 'info']);

/** The allowed tone for a value. */
export function toneOf(value) {
    return TONES.includes(value) ? value : 'neutral';
}

/** Puts exactly one `ss-w-tone-*` class on a node. */
export function setTone(node, value) {
    for (const tone of TONES) node.classList.remove(`ss-w-tone-${tone}`);
    node.classList.add(`ss-w-tone-${toneOf(value)}`);
}
