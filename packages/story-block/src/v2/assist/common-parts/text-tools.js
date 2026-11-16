// Small text helpers: a token estimate, a short stable hash and a word-aware cut.

import { cutAt } from '../../../../../../core/text.js';

/** Tokens as the prompt budget counts them (§5): about four characters each. */
export const estimateTokens = text => Math.ceil(String(text ?? '').length / 4);

/** A short, stable hash of `text` (FNV-1a, 32 bits) in base36: the same text gives the same key. */
export function hashText(text) {
    let hash = 0x811c9dc5;
    const source = String(text ?? '');
    for (let i = 0; i < source.length; i += 1) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
}

/** `text` cut to at most `limit` characters, on a word when one is near, with an ellipsis. */
export function clip(text, limit) {
    const source = String(text ?? '').trim();
    if (source.length <= limit) return source;
    const cut = cutAt(source, limit - 1);
    const space = cut.lastIndexOf(' ');
    return `${(space > limit * 0.8 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
