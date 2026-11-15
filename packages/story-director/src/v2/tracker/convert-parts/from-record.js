// Story Director v2, tracker part (convert): writes a v1 record back onto its thread and builds the key index.

import { FIELDS } from '../../../changes.js';
import { isOffer } from '../../../tracker.js';
import { OFFER_KINDS, stamp, text } from './shared-text.js';
import { sameValue } from './compare.js';
import { outcomeOf } from './outcome.js';

function compact(object) {
    return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined && value !== false && value !== ''));
}

/**
 * The thread a v1 record is after the rules ran. `before` is the thread as it was (null for a new
 * one); `rev` the revision this change commits as; `order` its place for a new thread;
 * No thread becomes an offer: the story's `+ quest` makes a quest at once, and a hook stays a hook. A
 * thread kept as an offer by an older chat stays one until a line makes it the quest (or closes it).
 */
export function fromRecord(record, before, { id, rev, order }) {
    const track = before?.track ?? {};
    const fields = {};
    for (const name of FIELDS) {
        if (name === 'desc') continue;
        const value = text(record.fields?.[name]);
        if (value) fields[name] = value;
    }
    for (const [label, value] of Object.entries(record.extra ?? {})) {
        if (text(value)) fields[label] = text(value);
    }
    const active = record.status === 'active';
    const job = OFFER_KINDS.has(record.kind);
    // `type: quest` is only how v1 knows an offer that has no giver or reward: it is never stored,
    // and it is read in again only while the record is such an offer.
    const injected = Boolean(track.typed) && fields.type === 'quest' && !before?.fields?.type;
    if (injected) delete fields.type;
    const own = injected ? { ...record, fields: { ...record.fields, type: '' } } : record;
    const typed = active && job && Boolean(track.typed) && !fields.type && !isOffer(own);
    const probe = typed ? { ...own, fields: { ...own.fields, type: 'quest' } } : own;
    const offer = Boolean(before?.offer) && !before.taken && active && job && isOffer(probe);
    // An offer is a quest not yet taken; one closed (declined, lapsed) stays a quest that was offered.
    const wasOffer = Boolean(before?.offer) || (before?.kind === 'quest' && track.was);
    const kind = offer || (!active && job && wasOffer) ? 'quest' : record.kind;
    const closedBefore = before && before.status !== 'active';
    const ended = active ? null : closedBefore && before.ended
        ? before.ended
        : { rev, ...(Number.isSafeInteger(record.resolved?.time) ? { at: record.resolved.time } : {}), reason: text(record.resolved?.reason), outcome: outcomeOf(record) };
    const closed = active ? null : closedBefore && track.closed ? track.closed : stamp(record.resolved);
    const thread = {
        id,
        kind,
        key: record.key,
        summary: text(record.fields?.desc),
        fields,
        status: active ? 'active' : 'resolved',
        offer,
        taken: before?.taken ?? null,
        ended,
        target: before?.target ?? null,
        reward: before?.reward ?? null,
        rev: before?.rev ?? rev,
        track: compact({
            order: track.order ?? order,
            created: stamp(record.created),
            changed: stamp(record.changed),
            seen: stamp(record.seen),
            closed,
            legSince: stamp(record.legSince),
            engaged: stamp(record.engaged),
            offeredAt: record.offeredAt || null,
            arc: record.arc || null,
            pinned: Boolean(record.pinned),
            was: kind !== record.kind ? record.kind : null,
            typed,
        }),
    };
    // Keys the v1 record has no part in (the quests' `ready`, an offer's `shown`) are kept as they
    // were, in their order, so an unchanged thread compares equal.
    for (const [name, value] of Object.entries(before ?? {})) if (!Object.hasOwn(thread, name)) thread[name] = value;
    if (before && !sameValue({ ...thread, rev: before.rev }, before)) thread.rev = rev;
    return thread;
}

/** The key index: each record's own key, then the names it was reached by (first record wins). */
export function keysOf(records, idOf) {
    const keys = {};
    for (const record of records) keys[record.id] = idOf(record);
    for (const record of records) {
        for (const alias of record.aliases ?? []) if (!Object.hasOwn(keys, alias)) keys[alias] = idOf(record);
    }
    return keys;
}
