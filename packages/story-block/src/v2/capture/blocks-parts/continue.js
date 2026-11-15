// Story Suite v2: where a Continue's own text starts in a reply, and whether it goes on with a block left open.

import { isSpace, parseLine } from '../lines.js';
import { hiddenPairs } from './marker.js';
import { commentParts } from './comment-parts.js';
import { bareBlocks } from './bare.js';

// The word after the hidden comment's marker when the reply was cut off inside its (last) block.
export const CUT_MARK = 'open';
// `text` ends with a hidden comment written for a block left open (hideBlock).
function endsInOpenBlock(text) {
    const last = hiddenPairs(text).at(-1);
    if (!last || text.slice(last.end).trim()) return false;
    return new RegExp(`^[ \\t]+${CUT_MARK}\\b`).test(text.slice(last.bodyStart, last.bodyEnd));
}

/**
 * Where a Continue's own text starts in `mes` (the reply after the Continue), given `base` (the reply
 * as it was before it) → { from, skip, tail? } for extractBlock, cutLine and hideBlock.
 * SillyTavern writes a continued reply again from its copy of the old text plus what was added, and
 * cleans the whole of it up (spaces at line ends and at the start dropped, blank lines collapsed when
 * that is set, the reader's regex scripts), so the old text can come back shorter than it was. A
 * place counted in the old text would then land inside the added text and its block be missed, left
 * bare for the reader to see. So `from` is found by following `base` through `mes` while passing over
 * whitespace on either side; where something else differs it stops there, early. `skip` is how many
 * whole bare blocks `base` already had (edited in by hand, never read): those are never read here,
 * even when `from` stopped early. Only bare blocks count: a hidden one was read before.
 */
//
// C2-2: when the reply was cut off inside its block (its hidden comment says so, see hideBlock) and the
// Continue's text goes on with it (a close tag comes before any open one, or its first line is a change
// line), `tail` is set: that text is the rest of the block. Story text that goes on is left as it is.
// `cut` (B-a1-14): the block's unfinished last line, kept in the comment; the Continue's text up to its
// first line break finishes it ("+ item Ro" + "pe | qty: 2"), read as one line.
export function continuation(base, mes, tag = 'Changes') {
    const before = String(base ?? '');
    const after = String(mes ?? '');
    const skip = bareBlocks(before, tag).filter(block => !block.open).length;
    // B-a1-14: the unfinished last line the reply's hidden comment kept, which the Continue's first line finishes.
    const last = endsInOpenBlock(before) ? hiddenPairs(before).at(-1) : null;
    const cut = last ? commentParts(before, last, tag).cut : null;
    const at = from => (last && goesOn(after, tag, from, cut) ? { from, skip, tail: true, ...(cut ? { cut } : {}) } : { from, skip });
    if (after.startsWith(before)) return at(before.length);
    let i = 0;
    let j = 0;
    while (i < before.length) {
        if (isSpace(before[i])) { i += 1; continue; }
        while (j < after.length && isSpace(after[j])) j += 1;
        if (after[j] !== before[i]) break;
        i += 1;
        j += 1;
    }
    return i < before.length ? { from: j, skip } : at(j);
}

// Does the text from `from` go on with a block left open: a close tag first, or a change line first (with
// `cut`, the unfinished line it goes on with, joined to its first line)?
function goesOn(mes, tag, from, cut = null) {
    const first = bareBlocks(mes, tag, from)[0];
    if (!first) return false;
    if (!first.open) return true;
    // (A Continue that starts on a new line leaves the cut line as it was; its own first line decides.)
    const own = first.body.split('\n')[0];
    const line = (cut && own.trim() ? `${cut}${own}` : first.body.trimStart().split('\n')[0]).trim();
    return !!line && !parseLine(line).error;
}
