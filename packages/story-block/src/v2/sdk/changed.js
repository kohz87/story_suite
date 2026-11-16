// The sdk's `changed` event: one tell per reply (or per out-of-turn change) of which domains moved, so a panel redraws what changed.

import { parsePath } from '../ops/paths.js';

const STAR = 2;   // the ranks of what is owed: a command, a turn, a head move
const REPLY_CAUSES = new Set(['story', 'system']);

// The domain names the ops touched, sorted ('/domains/<name>/…'; /meta is not a domain).
function domainsOf(ops) {
    const names = new Set();
    for (const op of ops) {
        let keys;
        try { keys = parsePath(op?.path); } catch { continue; }
        if (keys[0] === 'domains' && typeof keys[1] === 'string') names.add(keys[1]);
    }
    return [...names].sort();
}

/**
 * Listens to `committed`, `turn` and `head` on `events` and emits `changed` ({ keys, index, reason }) on the same bus:
 * - `turn` (a reply, a Re-read, a late line): the domains its stored ops touched since the last tell;
 * - `head` (a swipe, a delete, a rewind, a chat change): `['*']`; a `turn` that follows at once (a Re-read) joins it;
 * - `committed` of an out-of-turn change (a cause other than story/system): all of those in a row as one.
 * Each is told one microtask later, after every listener of the event that caused it has run.
 * A reply's own lines (cause story/system) wait for its `turn`. Nothing here touches the store's data or the other events.
 */
export function createChangedFeed({ store, events, defer = queueMicrotask }) {
    let seen = { index: -1, count: 0 };
    let pending = null;     // { star, reason } when a microtask flush is owed
    let queued = false;

    // The domains of the ops stored since the last look, and the head carrier's index.
    function take() {
        const index = store.headIndex();
        const ops = store.opsAt(index);
        const from = seen.index === index && seen.count <= ops.length ? seen.count : 0;
        seen = { index, count: ops.length };
        return { index, keys: domainsOf(ops.slice(from)) };
    }
    function tell(star, reason) {
        let found;
        try { found = take(); } catch { found = { index: null, keys: [] }; star = true; }
        events.emit('changed', { keys: star ? ['*'] : found.keys, index: found.index, reason });
    }
    // One tell is owed per microtask: what came in meanwhile (a head move, a turn, commands) joins it; a head move's ['*'] wins, then a turn's reason.
    function owe(name, rank) {
        if (!pending || rank >= pending.rank) pending = { rank, reason: name };
        if (queued) return;
        queued = true;
        defer(() => {
            queued = false;
            const due = pending;
            pending = null;
            tell(due.rank === STAR, due.reason);
        });
    }

    const offs = [
        events.on('committed', ({ receipt } = {}) => { if (!REPLY_CAUSES.has(receipt?.cause)) owe('command', 0); }),
        events.on('head', payload => owe(payload?.reason ?? 'head', STAR)),
        events.on('turn', () => owe('turn', 1)),
    ];
    return { stop: () => offs.forEach(off => off()) };
}
