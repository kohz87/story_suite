// Story Suite v2: finding the <tag>…</tag> blocks in a reply, trimming a block's body, and cutting off an unfinished last line.

import { escapeRe, MAX_LINE, NOTHING, parseLine } from '../lines.js';

// An open or a close tag. Attributes stay on the tag's own line and are short, so a tag cut off
// mid-way never reaches far ahead (and no tag costs more than its own few characters to read).
const tagRe = tag => new RegExp(`<(/?)${escapeRe(tag)}(?:[ \\t][^>\\n]{0,200})?[ \\t]*>`, 'gi');

// `text` without a last line that holds only whitespace: what `/\n\s*$/` removed, in one pass.
function dropBlankTail(text) {
    const nl = text.indexOf('\n', text.trimEnd().length);
    return nl < 0 ? text : text.slice(0, nl);
}
// `text` without a first line that holds only whitespace (`/^\s*\n/`).
function dropBlankHead(text) {
    const start = text.length - text.trimStart().length;
    const nl = text.lastIndexOf('\n', start - 1);
    return nl < 0 ? text : text.slice(nl + 1);
}
export const blockBody = body => dropBlankTail(dropBlankHead(body));

// Only spaces or tabs between `from` and the line's start (going back) or end (going on).
function blankBefore(text, at) {
    for (let i = at - 1; i >= 0; i -= 1) {
        const char = text[i];
        if (char === '\n') return true;
        if (char !== ' ' && char !== '\t' && char !== '\r') return false;
    }
    return true;
}
function blankAfter(text, at) {
    for (let i = at; i < text.length; i += 1) {
        const char = text[i];
        if (char === '\n') return true;
        if (char !== ' ' && char !== '\t' && char !== '\r') return false;
    }
    return true;
}

// Every <tag>…</tag> in `mes`, in order: { start, end, body }. A block left open (the reply was
// cut off) runs to the end of the text. Opens and closes are counted, so a block opened twice
// ends at its matching close, not the first one. A close tag ends a block only at the start of a line,
// or at the end of a line that is a whole change line before it (C-3): one in a line (`note: the
// </Changes> tag`, `| who: </Changes>`) is part of that line, so the lines after it are still read (and anything that is not a change line among them
// becomes a Problem), never dropped without a word.
// `openAt` (a Continue of a reply cut off inside its block, see continuation()): the search starts
// there, inside a block already open (its `start` and body start there).
export function findBlocks(mes, tag, openAt = -1) {
    const text = String(mes ?? '');
    const blocks = [];
    const re = tagRe(tag);
    let depth = 0;
    let start = 0;
    let bodyStart = 0;
    if (openAt >= 0) {
        re.lastIndex = openAt;
        depth = 1;
        start = openAt;
        bodyStart = openAt;
    }
    let match;
    while ((match = re.exec(text))) {
        if (!match[1]) {
            // C2-6: an open tag in the middle of story text ("a <Changes> word in it") is a mention, not
            // a block: it opens one only at the start or end of a line, or with a change line after it.
            if (!blankBefore(text, match.index) && !blankAfter(text, re.lastIndex) && !changeAfter(text, re.lastIndex)) continue;
            if (!depth) {
                start = match.index;
                bodyStart = re.lastIndex;
            }
            depth += 1;
            continue;
        }
        if (!depth) continue;   // a stray close outside a block
        // C-3: a close ends the block at the start of a line (alone, or with story after it, as a Continue
        // joins it), or at the end of a line that is a whole change line before it ("+ item Rope</Changes>");
        // one inside a line ("| note: </Changes>", "+ item Torch </Changes> and then") is part of that
        // line, so the block's later lines stay in it.
        if (!blankBefore(text, match.index) && !(blankAfter(text, re.lastIndex) && wholeBefore(text, match.index, bodyStart))) continue;
        depth -= 1;
        if (!depth) blocks.push({ start, end: re.lastIndex, body: text.slice(bodyStart, match.index) });
    }
    if (depth) blocks.push({ start, end: text.length, body: text.slice(bodyStart), open: true });
    return blocks;
}

// The line up to `at` (at most MAX_LINE characters looked at) is a whole change line (or "none"): it parses
// and does not end waiting for more (a label with no value, a dash, a bar).
function wholeBefore(text, at, floor = 0) {
    const start = Math.max(text.lastIndexOf('\n', at - 1) + 1, at - MAX_LINE, floor);
    const line = text.slice(start, at).trim();
    if (!line) return false;
    if (NOTHING.test(line)) return true;
    return /^[+\-~!?]/.test(line) && !/[|:—–-]$/.test(line) && !parseLine(line).error;
}

// The rest of the line from `at` (at most MAX_LINE characters looked at) is a change line.
function changeAfter(text, at) {
    const nl = text.indexOf('\n', at);
    const end = Math.min(nl < 0 ? text.length : nl, at + MAX_LINE);
    const rest = text.slice(at, end).trim();
    return !!rest && /^[+\-~!?]/.test(rest) && !parseLine(rest).error;
}

// A block left open ends where the reply stopped. Its last line is whole only when a line break follows
// it; with none it may be cut off mid-way ("+ item Ro" of "+ item Rope", by the reader's stop or by the
// length limit, B-a1-14), so it is never applied: it is left out, told (CUT_OFF), and kept in the hidden
// comment, where a Continue that goes on with it reads it joined to the Continue's first line
// (continuation()). A model that forgot the close tag loses its last line the same way (the Problem says
// how to get it back). `stopped` (the reader stopped the reply) no longer changes this.
// → { body, cut } (`cut`: the line left out, or '').
export function wholeLines(block) {
    if (!block.open || block.body.endsWith('\n')) return { body: block.body, cut: '' };
    const nl = block.body.lastIndexOf('\n');
    const last = block.body.slice(nl + 1).trim();
    if (!last) return { body: block.body, cut: '' };
    return { body: nl < 0 ? '' : block.body.slice(0, nl + 1), cut: last };
}
