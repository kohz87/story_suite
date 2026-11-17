// World events, the ids a list of events defines: the event ids that anchors such as `fired:<event>` and `stage:<event>`
// may name, added to the pack's own names. (Fact ids are not checked: facts also come from the Journal.)

import { isRecord } from './shared-check.js';

/** `refs` (from the pack) plus `events`, read from the raw list. */
export function worldRefsOf(refs, list) {
    const events = new Set(refs?.events ?? []);
    for (const raw of Array.isArray(list) ? list : []) if (isRecord(raw) && typeof raw.id === 'string') events.add(raw.id.toLowerCase());
    return { ...refs, events };
}
