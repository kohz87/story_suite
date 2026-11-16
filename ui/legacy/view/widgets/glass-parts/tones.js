// The ring colours a glass tile or status badge accepts, and the class setter for them.

/** Ring colours a tile or a status badge accepts (a class each, glass-*.css); anything else is neutral. */
export const GLASS_TONES = Object.freeze(['neutral', 'accent', 'good', 'warn', 'bad', 'info', 'uncommon', 'rare', 'epic', 'legendary']);

/** Exactly one `ss-tone-*` class on a node, from the allowed list (else neutral). */
export function setGlassTone(node, value, fallback = 'neutral') {
    for (const tone of GLASS_TONES) node.classList.remove(`ss-tone-${tone}`);
    const tone = GLASS_TONES.includes(value) ? value : fallback;
    if (tone) node.classList.add(`ss-tone-${tone}`);
}
