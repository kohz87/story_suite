// Writing a live-reply mark and the restore union that keeps marks across a rewind.
import { MARK_LIMIT, markedKeys } from './mark-keys.js';

// Writes the mark (and the monotonic epoch on the first one) into the chat state; returns true when it wrote.
export function markLiveReply(state, key, { enabled = true } = {}) {
    if (!enabled || !state || typeof key !== 'string' || !key) return false;
    const have = markedKeys(state);
    if (have.includes(key)) return false;
    const epoch = Number.isInteger(state.memoryFactMarks?.epoch) ? state.memoryFactMarks.epoch : 1;
    state.memoryFactMarks = { epoch, keys: [...have, key].slice(-MARK_LIMIT) };
    return true;
}

// The restore exception (amendment 3): a restored/replayed state keeps the live marks. Only well-formed key strings are taken, the saved ones first and
// the live ones after (so the newest survive the bound); the epoch only ever grows. Nothing else (no payload, ledger, cursor) is carried.
export function unionMarks(saved, live) {
    const keys = [...new Set([...markedKeys({ memoryFactMarks: saved }), ...markedKeys({ memoryFactMarks: live })])].slice(-MARK_LIMIT);
    if (!keys.length) return undefined;
    const epochs = [saved?.epoch, live?.epoch].filter(Number.isInteger);
    return { epoch: Math.max(1, ...epochs), keys };
}
