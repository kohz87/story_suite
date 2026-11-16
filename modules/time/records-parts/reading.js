// Reading one thread as the v1 record the time rules run on.

import { FIELDS, lineKey } from '../../world/changes.js';
import { isOffer } from '../tracker/tracker.js';
import { isInt } from './shared-int.js';

// v1's own kinds a job may be offered as before the reader takes it on.
const OFFER_KINDS = new Set(['hook', 'event']);
const DATE_FIELDS = ['on', 'due'];
const text = value => String(value ?? '');
const position = at => (at ? { message: at.turn ?? null, time: at.time ?? null } : { message: null, time: null });

// v1 keeps every line a record was written by; v2 keeps none, so "the beat was fired" (v1
// lapses.js: a `!` since its date was written) is read from what the thread keeps: the story
// changed it, in a later reply than the one that wrote it, at or after the start of its date.
// A beat the story touched once its day came is taken as played out, never slipped for it.
function firedHistory(thread, fields, calendar) {
    if (thread.kind !== 'beat' || !calendar) return [];
    const { created, changed: at } = thread.track ?? {};
    const changed = at?.time;
    if (!isInt(changed) || !isInt(at?.turn) || !(at.turn > (created?.turn ?? -1))) return [];
    for (const field of DATE_FIELDS) {
        const written = text(fields[field]).trim();
        if (!written) continue;
        const parsed = calendar.parse(written, { reference: changed });
        if (parsed && Number.isFinite(parsed.abs)) return parsed.abs <= changed ? [{ op: '!', text: '' }] : [];
    }
    return [];
}

/**
 * The v1 record a thread reads as (what lapses.js, relevance.js and note.js read: key, kind,
 * status, fields, engaged, positions). A job offered and not taken reads as v1's offer: a hook
 * (or the event it was offered as) that is a job, whatever words its fields hold.
 */
export function recordOf(thread, { calendar = null } = {}) {
    const track = thread.track ?? {};
    const fields = Object.fromEntries(FIELDS.map(name => [name, '']));
    const extra = {};
    for (const [label, value] of Object.entries(thread.fields ?? {})) {
        if (FIELDS.includes(label)) fields[label] = text(value);
        else extra[label] = text(value);
    }
    fields.desc = text(thread.summary);
    const offered = Boolean(thread.offer) && !thread.taken;
    const kind = thread.taken ? (OFFER_KINDS.has(thread.kind) ? 'quest' : thread.kind)
        : offered ? (OFFER_KINDS.has(track.was) ? track.was : 'hook') : thread.kind;
    const record = {
        key: thread.key,
        id: lineKey(thread.key),
        kind,
        status: thread.status === 'active' ? 'active' : 'resolved',
        fields,
        extra,
        created: position(track.created),
        changed: position(track.changed),
        seen: position(track.seen),
        resolved: thread.status === 'active' ? null : { ...position(track.closed), reason: text(thread.ended?.reason) },
        legSince: track.legSince ? position(track.legSince) : null,
        pinned: Boolean(track.pinned),
        arc: track.arc ?? null,
        aliases: [],
        history: firedHistory(thread, fields, calendar),
    };
    if (track.engaged) record.engaged = position(track.engaged);
    // Every v2 offer is a job to v1, so its deadline lapses it as v1's offers lapse.
    if (offered && record.status === 'active' && !isOffer(record)) record.fields = { ...fields, type: 'quest' };
    return record;
}
