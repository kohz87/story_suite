// Arc list, current arc, thread-arc mapping, and director.arc query.

import { arcBeats } from '../plan.js';
import { firedBeatIds } from '../../time/tracker/quiet.js';
import { isRecord } from './shared-records.js';

/** The arcs kept, oldest first (by rev, then id). */
export function arcList(arc) {
    const arcs = isRecord(arc?.arcs) ? Object.values(arc.arcs).filter(isRecord) : [];
    return arcs.sort((a, b) => (a.rev ?? 0) - (b.rev ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The current arc `{ …arc, active, ended }` (the newest), or null before the first. */
export function currentArc(arc) {
    const newest = arcList(arc).at(-1);
    if (!newest) return null;
    const ended = isRecord(arc?.ends?.[newest.id]) ? arc.ends[newest.id] : null;
    return { ...newest, active: !ended, ended };
}

/** The tracker's threads with the arc each belongs to (`arc`, from `track.arc`), in tracker order; `fired`: a beat the story fired with `!` (read from the quest log, nothing stored). */
export function threadsWithArc(director, state = null) {
    const fired = state ? firedBeatIds(director, state) : new Set();
    const threads = isRecord(director?.threads) ? Object.values(director.threads).filter(isRecord) : [];
    return threads
        .sort((a, b) => (a.track?.order ?? 0) - (b.track?.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(thread => ({ id: thread.id, kind: thread.kind, key: thread.key, summary: thread.summary, status: thread.status, fields: thread.fields ?? {}, offer: Boolean(thread.offer), ended: thread.ended ?? null, arc: thread.track?.arc ?? null, fired: fired.has(thread.id) }));
}

/**
 * `director.arc` → `{ current, previous, count }`: the current arc `{ id, key, desc, active, reason,
 * note, beats: { done, total }, ended: { reason } | null }` (null before the first), the one before it
 * `{ key, desc }`, and how many arcs this story has had.
 */
export function arcQuery(state) {
    const slice = state?.domains?.arc;
    const list = arcList(slice);
    const current = currentArc(slice);
    if (!current) return { current: null, previous: null, count: 0 };
    const { done, total } = arcBeats(threadsWithArc(state?.domains?.director, state), current.id);
    const before = list.at(-2) ?? null;
    return {
        current: {
            id: current.id, key: current.key, desc: current.desc, active: current.active, reason: current.reason, note: current.note,
            beats: { done, total }, ended: current.ended ? { reason: current.ended.reason } : null,
        },
        previous: before ? { key: before.key, desc: before.desc } : null,
        count: list.length,
    };
}
