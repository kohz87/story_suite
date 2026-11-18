// Story Suite v2: the history keeps the narrator's own change blocks on its newest replies (host setting `keepRecentBlocks`,
// default off; Settings › Models › Calls). Every other reply loses its blocks as before (prompt-build.js stripHistory). Only the
// reply's own chat-completion prompt gets them (prompt-hooks.js); quiet, background and other callers' prompts never do.

import { extractBlock } from '../capture.js';
import { CUT_MARK, hiddenPairs } from '../capture/blocks.js';
import { mapContent } from './text.js';

/** How many of the newest replies keep their block. */
export const KEEP_REPLIES = 2;

// A block the reply was cut off in (hideBlock's `open` mark): its last line may be unfinished, so it is never shown back.
const cutOff = text => hiddenPairs(text).some(pair => new RegExp(`^[ \\t]+${CUT_MARK}\\b`).test(text.slice(pair.bodyStart, pair.bodyEnd)));

// The narrator's own lines in one text, written back as a bare block after its stripped story; '' when it has none.
function keptBlock(text) {
    if (cutOff(text)) return '';
    const lines = String(extractBlock(text) ?? '').split('\n').map(line => line.trimEnd()).filter(line => line.trim()).join('\n');
    return lines ? `\n\n<Changes>\n${lines}\n</Changes>` : '';
}

// `content` (a string or a list of parts) with `block` after its last text part; null when it has none.
function withBlock(content, block) {
    if (typeof content === 'string') return `${content}${block}`;
    if (!Array.isArray(content)) return null;
    const at = content.findLastIndex(part => typeof part === 'string' || typeof part?.text === 'string');
    if (at < 0) return null;
    const part = content[at];
    return content.map((item, i) => (i !== at ? item : typeof part === 'string' ? `${part}${block}` : { ...part, text: `${part.text}${block}` }));
}

/**
 * `chat` (the prompt's messages, already stripped by stripHistory) with the newest `count` assistant messages written again from
 * `originals` (their content before the strip): the stripped story (`strip`, one message's content → its stripped content) plus
 * the narrator's own lines as a bare `<Changes>` block. Assist, repair, echo and cut sections never come back, nor a block the reply
 * was cut off in. `skipLast`: the newest assistant message is a Continue's own reply, left as it is and not counted.
 * → the number of characters added to the prompt.
 */
export function keepBlocks(chat, originals, strip, { count = KEEP_REPLIES, skipLast = false } = {}) {
    let left = count;
    let skip = skipLast;
    let added = 0;
    for (let i = chat.length - 1; i >= 0 && left > 0; i -= 1) {
        const message = chat[i];
        if (message?.role !== 'assistant') continue;
        if (skip) { skip = false; continue; }
        left -= 1;
        const original = originals[i];
        const blocks = [];
        mapContent(original, text => { blocks.push(keptBlock(text)); return text; });
        const block = blocks.filter(Boolean).join('');
        if (!block) continue;
        const content = withBlock(strip(original), block);
        if (content === null) continue;
        message.content = content;
        added += block.length;
    }
    return added;
}
