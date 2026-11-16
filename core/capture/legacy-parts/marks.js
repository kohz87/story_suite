// Story Suite v2: the Problem and the comment mark that tell a block was read from a v1 envelope.

import { hiddenPairs, commentParts } from '../blocks.js';

/** The one Problem a reply that wrote its changes only in a v1 envelope gets. */
export const LEGACY_PROBLEM = 'The narrator wrote its changes in an old format; they were read anyway.';
// The word after the hidden comment's marker when its block was read from a v1 envelope, so a Re-read tells it again.
export const LEGACY_MARK = 'legacy';

/** True when a hidden comment of `mes` says its block was read from a v1 envelope (hideBlock's `legacy`). */
export function legacyRead(mes) {
    const text = String(mes ?? '');
    return hiddenPairs(text).some(pair => commentParts(text, pair).head.has(LEGACY_MARK));
}
