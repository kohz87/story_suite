// Where a rescued change's message is in its chat file now (rescueIndex), whether the file already holds a record (holdsRecord), and the newest record of a copy (newestRecord).

import { isPlain } from './shared-plain.js';

// The record of the last carrier that has one (with a `sid`), or null.
export function newestRecord(messages) {
    for (let i = (messages?.length ?? 0) - 1; i >= 0; i--) {
        const record = messages[i]?.extra?.storySuite;
        if (isPlain(record) && typeof record.sid === 'string') return record;
    }
    return null;
}
const sidOf = message => message?.extra?.storySuite?.sid;
// The story text before any tag (the change block, hidden or not, comes after it).
const storyText = message => String(message?.mes ?? '').split('<')[0].trimEnd();
const sameText = (a, b) => !!a && !!b && storyText(a) === storyText(b);

// C4-4: where the message a rescued change was written on is in its chat file now. The index it had
// when the record was written is a guess only (a message deleted before it shifts it, and SillyTavern
// saves the chat itself then): the message holding the same record (`sid`) comes first, then the one
// at that index with the same story text, then the only other one with it. carryRecord checks the
// swipe, the author and the date. → its index, or -1.
export function rescueIndex(message, messages, index) {
    const sid = sidOf(message);
    if (typeof sid === 'string') {
        const at = messages.findIndex(other => sidOf(other) === sid);
        if (at >= 0) return at;
    }
    if (sameText(messages[index], message)) return index;
    const same = [];
    messages.forEach((other, at) => { if (sameText(other, message)) same.push(at); });
    return same.length === 1 ? same[0] : -1;
}

// The file's message already holds this record as it is (same `sid` and `rev`).
export function holdsRecord(there, message) {
    const own = message?.extra?.storySuite;
    const kept = there?.extra?.storySuite;
    return isPlain(own) && isPlain(kept) && typeof own.sid === 'string' && kept.sid === own.sid && kept.rev === own.rev
        && JSON.stringify(kept.ops) === JSON.stringify(own.ops);
}
