// Carries an unfinished interaction into the next reply's segment and restores the base after a take-back.

import { hashJson } from '../replay.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const clone = value => structuredClone(value);

const namedParts = id => {
    const parts = String(id ?? '').split(':');
    if (parts.length < 3) return { origin: '', attempt: 0 };
    const attempt = Number(parts.at(-2));
    return { origin: parts.slice(0, -2).join(':'), attempt: Number.isSafeInteger(attempt) && attempt >= 0 ? attempt : 0 };
};

/** Records a settled segment's last payload and opens the next segment when the kind carries an unfinished result. */
export function receiveSegment(meta, kind, payload, result, sid, receiptId = null, state = null) {
    if (!plain(meta) || !plain(payload) || !plain(result) || !text(sid) || !text(payload.id) || !text(payload.key)
        || !Number.isSafeInteger(payload.offset) || !Number.isSafeInteger(payload.seed) || !Array.isArray(payload.steps)) return false;
    meta.last = clone(payload);
    if (result.stop !== 'open' || kind?.carry !== true || typeof kind.next !== 'function') {
        delete meta.open;
        return true;
    }
    let setup;
    try { setup = kind.next(clone(payload.setup), clone(result), state); } catch { return false; }
    if (!plain(setup)) return false;
    const current = plain(meta.open) ? meta.open : null;
    const parts = namedParts(payload.id);
    const base = plain(current?.base)
        ? clone(current.base)
        : { offset: payload.offset, anchor: payload.anchor, setup: clone(payload.setup) };
    const next = {
        v: 1,
        id: payload.id,
        kindId: payload.kindId,
        version: payload.version,
        origin: text(current?.origin) ? current.origin : parts.origin,
        anchor: sid,
        attempt: Number.isSafeInteger(current?.attempt) ? current.attempt : parts.attempt,
        seed: payload.seed,
        offset: payload.offset + payload.steps.length,
        setup,
        steps: [],
        base,
        carriedKey: payload.key,
        prior: hashJson(result),
    };
    if (typeof receiptId === 'string' && receiptId) next.carried = receiptId;
    if (text(payload.player)) next.player = payload.player;
    if (plain(payload.policy)) next.policy = clone(payload.policy);
    meta.open = next;
    return true;
}

/** A rewind or delete can take back the receipt that carried the open segment; restore its base or mark staged steps invalid. */
export function reconcileSession(meta, hasReceipt) {
    if (!plain(meta) || !plain(meta.open) || typeof hasReceipt !== 'function') return plain(meta?.open) ? meta.open : null;
    const session = meta.open;
    if (!text(session.carried)) return session;
    let alive = false;
    try { alive = hasReceipt(session.carried) === true; } catch { alive = true; }
    if (alive) {
        delete session.invalidated;
        return session;
    }
    if (Array.isArray(session.steps) && session.steps.length) {
        session.invalidated = true;
        return session;
    }
    const base = plain(session.base) ? session.base : { offset: 0, anchor: session.anchor, setup: session.setup };
    session.offset = Number.isSafeInteger(base.offset) && base.offset >= 0 ? base.offset : 0;
    if (text(base.anchor)) session.anchor = base.anchor;
    if (plain(base.setup)) session.setup = clone(base.setup);
    if (plain(base.opening)) session.opening = clone(base.opening);
    session.steps = [];
    delete session.invalidated;
    delete session.witness;
    delete session.carried;
    delete session.carriedKey;
    delete session.prior;
    delete session.base;
    return session;
}
