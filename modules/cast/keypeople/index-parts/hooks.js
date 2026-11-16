// Story Director v2, part **keypeople**: the hooks that sync NPC State Delta's removals before a reply and tell their card lines after.

import { keyPeopleOn } from '../note.js';
import { nsdVerdicts } from '../nsd.js';

/** `beforeGenerate(view)`: one `keypeople.sync` step when NPC State Delta says a pinned person is archived or dead (or newly known). */
export function beforeGenerate(view) {
    if (!keyPeopleOn(view)) return undefined;
    const slice = view?.state?.domains?.keypeople;
    if (!slice || !Object.keys(slice.pins ?? {}).length) return undefined;
    const { released, known } = nsdVerdicts(slice, { query: typeof view.query === 'function' ? (name, args) => view.query(name, args) : null });
    if (!released.length && !known.length) return undefined;
    return { commands: [{ type: 'keypeople.sync', payload: { ...(released.length ? { who: released } : {}), ...(known.length ? { known } : {}) } }] };
}

/**
 * `afterCapture(view)`: one `keypeople.tell` step on the reply just read when NPC State Delta's removals of the step before it are not told
 * on a card yet. The removal itself was stored on the reply before (it ran before the reply was written, so the narrator is not told of
 * the person); its card line belongs to the reply that followed. A swipe, a Re-read or a delete of this reply takes the line back and
 * the next one says it again.
 */
export function afterCapture(view) {
    if (!keyPeopleOn(view)) return undefined;
    const gone = view?.state?.domains?.keypeople?.gone;
    const who = Object.entries(gone && typeof gone === 'object' ? gone : {}).filter(([, entry]) => entry?.owed === true).map(([key]) => key).slice(0, 24);
    return who.length ? { commands: [{ type: 'keypeople.tell', payload: { who } }] } : undefined;
}
