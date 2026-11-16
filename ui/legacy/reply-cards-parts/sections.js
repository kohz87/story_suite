// Orders the sections of the one card under a reply and names their headings.

import { oneLine } from '../../../core/text.js';

// ---- The one card under a reply ("This reply") ----------------------------------------------------------------------------
// Every module's card screen (mount `card`: "Changed this reply" and every other module's) is a
// section of one card. Closed, the card is one line: each section's own summary, joined with " · ". Pure; no DOM.

/** The key the one card carries (`data-ss-card`, and its open state per reply). */
export const THIS_REPLY_ID = 'this-reply';

/** The sections in order: the ids in `first` lead (in that order), the rest keep the order they came in. */
export function orderSections(entries, first = []) {
    const list = Array.isArray(entries) ? entries : [];
    const lead = (Array.isArray(first) ? first : []).flatMap(id => list.filter(entry => entry?.id === id));
    return [...lead, ...list.filter(entry => !lead.includes(entry))];
}

/** A section's small heading: the card's own title (its id when it has none). */
export function sectionHeading(entry) {
    return oneLine(entry?.screen?.title ?? '', 60) || String(entry?.id ?? '');
}
