// Story Suite v2: the blocks a read takes (bare, or kept in a hidden comment) and the line a reply was cut off in.

import { replacePairs, blank } from './pairs.js';
import { hiddenPairs } from './marker.js';
import { commentText } from './comment-text.js';
import { commentParts, commentBlocks } from './comment-parts.js';
import { findBlocks, wholeLines } from './find.js';
import { withoutReasoning } from './reasoning.js';
import { bareBlocks } from './bare.js';

/**
 * The change line a reply ended in the middle of (its block left open, the last line with no line break
 * after it), or null. extractBlock and hideBlock leave that line out; turn.js tells it as a Problem.
 * `at` (continuation()): only a Continue's own blocks are looked at (a line it finished is whole).
 */
export function cutLine(mes, tag = 'Changes', at = null) {
    const last = readBlocks(mes, tag, at).at(-1);
    return last ? wholeLines(last).cut || null : null;
}

// The bare blocks a Continue added: from the `skip`th bare block on, ending after `from` (C2-2: a
// block whose open tag was cut, "<Chan" + "ges>…", starts before the Continue's text). With `tail`
// the Continue's text starts inside the block the reply was cut off in (continuation()).
const laterBlocks = (mes, tag, { from = 0, skip = 0, tail = false } = {}) => (tail
    ? bareBlocks(mes, tag, from)
    : bareBlocks(mes, tag).filter((block, i) => i >= skip && block.end > from));

// The blocks of `mes` that extractBlock reads, in order: with `at`, the bare ones a Continue added (the
// first one joined to the unfinished line it goes on with, `at.cut`); else every block outside reasoning,
// one kept in a hidden comment read back as it was before it was made comment-safe (commentText), with
// the display kinds its comment marks as off (`off`).
export function readBlocks(mes, tag, at) {
    if (at) {
        const blocks = laterBlocks(mes, tag, at);
        if (at.tail && at.cut && blocks.length) blocks[0] = { ...blocks[0], body: `${at.cut}${blocks[0].body}` };
        return blocks;
    }
    // Each hidden comment's blocks are read inside it (a tag nested in a kept body never runs past the
    // comment's end into what follows), the bare blocks with the comments blanked; in order.
    const text = withoutReasoning(mes);
    const pairs = hiddenPairs(text);
    const out = [];
    for (const pair of pairs) {
        const off = commentParts(text, pair, tag).off;
        for (const block of findBlocks(commentBlocks(text.slice(pair.bodyStart, pair.bodyEnd), tag), tag)) {
            out.push({ ...block, start: block.start + pair.bodyStart, end: block.end + pair.bodyStart, body: commentText(block.body), off });
        }
    }
    out.push(...findBlocks(replacePairs(text, pairs, blank), tag));
    return out.sort((x, y) => x.start - y.start);
}
