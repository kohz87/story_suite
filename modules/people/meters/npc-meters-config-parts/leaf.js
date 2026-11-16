// Reading and writing a record's small object as one text leaf.
import { isObject } from './values.js';

// A record's small objects (mood, inst, pull, track) are stored as ONE text leaf (JSON), like `via`: the host writes a changed object key by
// key, and a replay without the reply that made the object would skip every key. A text leaf is one op (`replace`, an `add` when the key is
// missing), so a middle delete never leaves it without its parent. Old stored states hold the object itself: reading accepts both.
export const leafText = value => JSON.stringify(value);
export function readLeaf(raw) {
    if (typeof raw !== 'string') return raw;
    try { const value = JSON.parse(raw); return isObject(value) ? value : undefined; } catch { return undefined; }
}
