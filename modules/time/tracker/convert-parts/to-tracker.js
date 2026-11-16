// Story Director v2, tracker part (convert): reads the `director` domain as a v1 tracker (thread order, one record per thread).

import { FIELDS, lineKey } from '../../../changes.js';
import { OFFER_KINDS, position, text } from './shared-text.js';

/** Threads in tracker order: by `track.order`, then by id, so a rebuilt state reads the same. */
export function orderedThreads(director) {
    return Object.values(director?.threads ?? {}).sort((a, b) =>
        (a.track?.order ?? 0) - (b.track?.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The names that reach each thread (`director.keys` turned round): `Map(id → [name])`, as stored. */
function namesById(director) {
    const names = new Map();
    for (const [name, id] of Object.entries(director?.keys ?? {})) {
        if (!names.has(id)) names.set(id, []);
        names.get(id).push(name);
    }
    return names;
}

/** The names other than its own key that reach a thread (v1 aliases), oldest first as stored. */
function aliasesOf(names, thread) {
    const own = lineKey(thread.key);
    return (names.get(thread.id) ?? []).filter(name => name !== own);
}

/** The v1 record a thread reads as. */
export function toRecord(thread, aliases = []) {
    const track = thread.track ?? {};
    const fields = Object.fromEntries(FIELDS.map(name => [name, '']));
    const extra = {};
    for (const [label, value] of Object.entries(thread.fields ?? {})) {
        if (FIELDS.includes(label)) fields[label] = text(value);
        else extra[label] = text(value);
    }
    fields.desc = text(thread.summary);
    // An offer the story wrote as `+ quest` with nothing that makes it a job: v1 knows it as a job
    // by its type, so it is read with `type: quest` (never written back).
    if (track.typed && !fields.type) fields.type = 'quest';
    // A job taken on (SD-quests' Take on) is a quest whatever it was offered as.
    const kind = thread.taken && !thread.acceptance ? (OFFER_KINDS.has(thread.kind) ? 'quest' : thread.kind)
        : thread.offer && thread.kind === 'quest' ? track.was || 'hook' : thread.kind;
    const superseded = thread.status !== 'active' && thread.ended?.outcome === 'superseded';
    const status = thread.status === 'active' ? 'active' : superseded ? 'superseded' : 'resolved';
    const record = {
        key: thread.key,
        id: lineKey(thread.key),
        kind,
        status,
        fields,
        extra,
        created: position(track.created),
        changed: position(track.changed),
        seen: position(track.seen),
        resolved: status === 'active' ? null : { ...position(track.closed), reason: text(thread.ended?.reason) },
        legSince: track.legSince ? position(track.legSince) : null,
        pinned: Boolean(track.pinned),
        arc: track.arc ?? null,
        aliases: [...aliases],
        history: [],
    };
    if (track.engaged) record.engaged = position(track.engaged);
    if (track.offeredAt) record.offeredAt = track.offeredAt;
    return record;
}

/** The v1 tracker the domain reads as: `{ version, records, message, time }`. */
export function toTracker(director) {
    // The key index is turned round once: looked up per thread it made this quadratic (B-b1-capture-13).
    const names = namesById(director);
    const records = orderedThreads(director).map(thread => toRecord(thread, aliasesOf(names, thread)));
    return { version: 1, records, message: director?.turn?.n ?? -1, time: director?.time?.minutes ?? null };
}
