// Story Suite v2: telling whether a reply holds a v1 envelope and taking it out.

import { HAS_LEGACY, legacyPairs, cutPairs } from './pairs.js';

/** True when `mes` holds a v1 envelope. */
export function hasLegacy(mes) {
    return HAS_LEGACY.test(String(mes ?? '')) && legacyPairs(String(mes)).length > 0;
}

/** `mes` without its v1 envelopes (and the whitespace before each). Unchanged when it has none. */
export function stripLegacy(mes) {
    const text = String(mes ?? '');
    return HAS_LEGACY.test(text) ? cutPairs(text, legacyPairs(text)) : text;
}
