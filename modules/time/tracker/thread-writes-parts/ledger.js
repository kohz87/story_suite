// The thread write ledger: the public projection, preparing a write, its ledger entry and its writer ID.

import { copy, failure } from './shared-results.js';

const recordId = value => typeof value === 'string' && /^[a-z][a-z0-9]*_[0-9a-z]{8}$/.test(value);

/** Canonical public projection: include every public field, including rev; omit only track. */
export function threadProjection(thread) {
    if (!thread) return null;
    const { track: _track, ...publicFields } = thread;
    return copy(publicFields);
}

/**
 * Prepare a write against the SD-owned director.writes map. Hash is supplied by ctx.hash;
 * no module imports the host's private query runner or chooses a different hash algorithm.
 * The returned saved result wins before stale/transition checks.
 */
export function prepareThreadWrite(director, type, payload, hash) {
    if (!recordId(payload?.write)) return failure('INVALID', 'A thread write needs its host-persisted write ID.');
    if (typeof hash !== 'function') return failure('DEPENDENCY_UNAVAILABLE', 'The host hash function is unavailable.');
    const { write, ...meaning } = payload;
    let fingerprint;
    try { fingerprint = hash({ type, payload: meaning }); }
    catch { return failure('INVALID', 'A thread write must contain normalized JSON.'); }
    const previous = director?.writes?.[write];
    if (previous) {
        return previous.fingerprint === fingerprint
            ? { ok: true, retry: true, result: copy(previous.result) }
            : failure('CONFLICT', 'This write ID was already used with different meaning.');
    }
    const thread = director?.threads?.[payload.thread];
    const currentHash = thread ? hash(threadProjection(thread)) : null;
    if (type === 'threads.offer') {
        if (payload.expectedHash !== null) return failure('INVALID', 'A new offer expects no previous thread.');
        if (thread) return failure('CONFLICT', 'This thread ID is already occupied.');
    } else {
        if (!thread) return failure('NOT_FOUND', 'There is no such thread.');
        if (payload.expectedHash !== currentHash) return failure('STALE', 'This thread changed before the write.');
    }
    return { ok: true, retry: false, fingerprint, currentHash };
}

/** A ledger entry to add atomically with its owner's thread changes, never before them. */
export function threadWriteEntry(prepared, result) {
    if (!prepared?.ok || prepared.retry || typeof prepared.fingerprint !== 'string') throw new TypeError('A fresh prepared write is required.');
    return { fingerprint: prepared.fingerprint, result: copy(result) };
}

/**
 * A stable writer key on the caller's Source, kept by the writes ledger across retry/reload. The Source's ordinal is left out: a Re-read gives its blocks fresh ordinals
 * (so one reply's blocks never share one), and an id made from it would change on every Re-read of a reply that holds a fight or any other guarded block.
 * The reply's own ids and the writer key (the thread's id, one per thread) already tell the writes apart.
 */
export function threadWriteId(ctx, key) {
    if (!ctx.source || typeof ctx.hash !== 'function') return ctx.fail('DEPENDENCY_UNAVAILABLE', 'Thread writes need a host Source.');
    const { ordinal: _ordinal, ...source } = ctx.source;
    return `wr_${ctx.hash({ source, writer: key }).slice(0, 8)}`;
}
