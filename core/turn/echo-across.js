// Story Suite v2: the guard across replies (HK-2). With the host setting `keepRecentBlocks` on, the model sees the change blocks of the two
// replies before this one, and may copy a `+` line from them. A `+ item` or `+ coin` line of this reply's own block identical in every part (op, kind, name, text and each label) to a line
// of those two blocks is dropped unless the reply's story, after its first paragraph, shows it happening again (names one of the line's words): so a copied line is never applied twice. Conservative: a line with no word to look for stays. Read from the stored chat only, so a
// Re-read, a swipe and a reload judge it the same way as the live reply did.

import { parseLine } from '../capture/lines.js';
import { stripBlock, withoutReasoning } from '../capture.js';
import { KEEP_REPLIES, keptLines } from './keep-blocks.js';

// The kinds whose `+` line adds again each time it is applied (a stack of items, a purse); other kinds name a person, place, hook or a data module's
// entry, where the same line is refused or changes nothing, or (a data module) names only the module, not the thing.
const ADDITIVE = new Set(['item', 'coin']);

const norm = value => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
// The whole line: op, kind, name, the free text and every label/value. Any difference (another quantity, another note) makes it a different line.
const keyOf = line => JSON.stringify([line.op, line.kind, norm(line.name), norm(line.text), Object.entries(line.labels ?? {}).map(([k, v]) => [norm(k), norm(v)]).sort()]);
const wordsOf = text => String(text ?? '').toLowerCase().match(/\p{L}{3,}/gu) ?? [];

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
            if (!line.error && line.op === '+' && ADDITIVE.has(line.kind)) keys.add(keyOf(line));
        }
    }
    return keys;
}

/** `lines` (the parsed lines of reply `index`'s own block) without the `+` lines repeated from the two earlier blocks that its story does not show again. */
export function dropRepeats(lines, chat, index) {
    if (!lines.some(line => line.op === '+')) return lines;
    const earlier = earlierKeys(chat, index);
    if (!earlier.size) return lines;
    const paragraphs = stripBlock(withoutReasoning(String(chat[index]?.mes ?? ''))).toLowerCase().split(/\n\s*\n/).filter(part => part.trim());
    // The first paragraph may only recall the last reply, so a mention counts when it comes after it; a one-paragraph reply is read whole.
    const story = (paragraphs.length > 1 ? paragraphs.slice(1) : paragraphs).join('\n');
    return lines.filter(line => {
        if (line.op !== '+' || !ADDITIVE.has(line.kind) || !earlier.has(keyOf(line))) return true;
        const words = [...wordsOf(line.name), ...wordsOf(line.text), ...Object.values(line.labels ?? {}).flatMap(wordsOf)];
        return !words.length || words.some(word => story.includes(word));
    });
}
