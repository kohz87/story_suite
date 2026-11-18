// Story Suite v2: the guard across replies (HK-2). With the host setting `keepRecentBlocks` on, the model sees the change blocks of the two
// replies before this one, and may copy a `+` line from them. A `+` line of this reply's own block with the same op, kind and name as a line
// of those two blocks is dropped unless the reply's story shows it happening again (the story names one of the line's words): so a copied
// `+ coin` or `+ item` line is never applied twice. Conservative: a line with no word to look for stays. Read from the stored chat only, so a
// Re-read, a swipe and a reload judge it the same way as the live reply did.

import { parseLine } from '../capture/lines.js';
import { stripBlock, withoutReasoning } from '../capture.js';
import { KEEP_REPLIES, keptLines } from './keep-blocks.js';

const keyOf = line => `${line.op}|${line.kind}|${String(line.name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()}`;

// The `+` keys of the own blocks of the KEEP_REPLIES replies before `index` (the ones the prompt shows).
function earlierKeys(chat, index) {
    const keys = new Set();
    let left = KEEP_REPLIES;
    for (let i = Math.min(index, chat.length) - 1; i >= 0 && left > 0; i -= 1) {
        const message = chat[i];
        if (!message || message.is_user || message.is_system) continue;
        left -= 1;
        for (const raw of keptLines(String(message.mes ?? ''))) {
            const line = parseLine(raw);
            if (!line.error && line.op === '+') keys.add(keyOf(line));
        }
    }
    return keys;
}

/** `lines` (the parsed lines of reply `index`'s own block) without the `+` lines repeated from the two earlier blocks that its story does not show again. */
export function dropRepeats(lines, chat, index) {
    if (!lines.some(line => line.op === '+')) return lines;
    const earlier = earlierKeys(chat, index);
    if (!earlier.size) return lines;
    const story = stripBlock(withoutReasoning(String(chat[index]?.mes ?? ''))).toLowerCase();
    return lines.filter(line => {
        if (line.op !== '+' || !earlier.has(keyOf(line))) return true;
        const words = String(line.name ?? '').toLowerCase().match(/\p{L}{3,}/gu) ?? [];
        return !words.length || words.some(word => story.includes(word));
    });
}
