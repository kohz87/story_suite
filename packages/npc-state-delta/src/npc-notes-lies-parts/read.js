// Reading the stored lies leaf into a checked list.
import { LIES_MAX, LIE_TO_MAX, LIE_SAID_MAX, LIES_TEXT_MAX } from './shared-limits.js';
import { ID_MAX } from './shared-text.js';
import { replyOk, dayOk, text } from './shared-valid.js';

function validLie(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    if (!text(item.id, ID_MAX) || !text(item.to, LIE_TO_MAX) || !text(item.said, LIE_SAID_MAX)) return false;
    if (!dayOk(item.day) || !replyOk(item.r)) return false;
    if (item.caught === undefined) return true;
    return !!item.caught && typeof item.caught === 'object' && !Array.isArray(item.caught) && dayOk(item.caught.day) && replyOk(item.caught.r);
}

/** The parsed lies of stored text (oldest first), or null when the text is absent, too long, or not valid in every part. */
export function readLies(stored) {
    if (typeof stored !== 'string' || !stored || stored.length > LIES_TEXT_MAX) return null;
    let value;
    try { value = JSON.parse(stored); } catch { return null; }
    if (!Array.isArray(value) || value.length > LIES_MAX || !value.every(validLie)) return null;
    return value;
}

export const listOf = stored => readLies(stored) || [];
