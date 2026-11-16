// Carries an unfinished fight into a new segment when its reply is captured, and puts it back after a rewind.
import { equipmentForBoard } from '../engine.js';
import { orderOf } from '../../resolve.js';
import { carriedFrom } from '../members.js';
import { KEY, LAST } from './shared-keys.js';
import { OPENING_KEYS, object } from './shared-meta.js';
import { boardSession } from './current.js';

const openingContext = setup => Object.fromEntries(OPENING_KEYS.filter(key => Object.hasOwn(setup ?? {}, key))
    .map(key => [key, structuredClone(setup[key])]));
/** Once captured, an unfinished fight starts a new segment. */
export function receiveBoard(meta, payload, result, sid, receiptId = null, state = null, query = null) {
    if (!object(meta) || !object(payload?.board) || !object(result) || typeof sid !== 'string' || !sid) return false;
    meta[LAST] = structuredClone(payload);
    const board = payload.board;
    if (result.stop !== 'open') { delete meta[KEY]; return true; }
    const carried = board.setup.members === 1 ? carriedFrom(result.members) : null;
    const current = boardSession(meta), nextOffset = board.setup.offset + board.exchanges.length;
    if (current?.id === board.id && current.setup?.seed === board.setup.seed && current.setup.offset === nextOffset
        && current.base?.offset === board.setup.offset && (!current.carriedKey || current.carriedKey === payload.key)
        && JSON.stringify(current.setup.order ?? []) === JSON.stringify(result.order ?? [])) {
        current.anchor = sid;
        delete current.setup.invalidated;
        delete current.setup.opened;
        if (carried) current.setup.carriedMembers = carried; else delete current.setup.carriedMembers;
        if (typeof receiptId === 'string') current.carried = receiptId;
        current.carriedKey = payload.key;
        return true;
    }
    const base = { offset: board.setup.offset, order: structuredClone(board.setup.order ?? null),
        carriedMembers: structuredClone(board.setup.carriedMembers ?? null), ...openingContext(board.setup) };
    const setup = { ...structuredClone(board.setup), offset: nextOffset, order: structuredClone(result.order ?? []), ...(carried ? { carriedMembers: carried } : {}) };
    delete setup.witness;
    delete setup.opening;
    delete setup.approach;
    delete setup.drop;
    delete setup.opened;
    if (setup.gear && state) Object.assign(setup, equipmentForBoard(state, setup.gear, query));
    meta[KEY] = { id: board.id, origin: board.id.split(':')[0], anchor: sid, groups: structuredClone(board.groups),
        setup, exchanges: [], carriedKey: payload.key, ...(typeof receiptId === 'string' ? { carried: receiptId } : {}), base };
    return true;
}

/**
 * A rewind or delete can take back the receipt that carried the current segment. The chat metadata then
 * still holds that segment's offset; put it back to where the segment began so the same dice are played.
 * `hasReceipt(id)` answers whether that receipt is still in the current timeline.
 */
export function reconcileBoard(meta, hasReceipt) {
    const session = boardSession(meta);
    if (!session || typeof session.carried !== 'string' || typeof hasReceipt !== 'function') return session;
    let alive = false;
    try { alive = hasReceipt(session.carried) === true; } catch { alive = true; }
    if (alive) { delete session.setup.invalidated; return session; }
    if (session.exchanges.length) {
        session.setup.invalidated = true;
        return session;
    }
    const base = object(session.base) ? session.base : { offset: 0, order: null };
    session.setup = { ...session.setup, offset: Number.isSafeInteger(base.offset) ? base.offset : 0 };
    if (orderOf(base.order)) session.setup.order = structuredClone(base.order); else delete session.setup.order;
    if (object(base.carriedMembers)) session.setup.carriedMembers = structuredClone(base.carriedMembers);
    else delete session.setup.carriedMembers;
    for (const key of OPENING_KEYS) {
        if (Object.hasOwn(base, key)) session.setup[key] = structuredClone(base[key]);
        else delete session.setup[key];
    }
    delete session.setup.witness;
    // Choices staged after the take-back are kept; they now roll from the segment's first die.
    delete session.carried;
    delete session.carriedKey;
    delete session.base;
    return session;
}
