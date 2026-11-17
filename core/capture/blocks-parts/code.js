// Story Suite v2: the code spans of a reply (inline `code`, closed fenced blocks), blanked so a tag named inside them is not read as a block.

import { escapeRe } from '../lines.js';

// A closed fenced block (``` or ~~~ at a line start, the same fence closing it); an unclosed fence is left alone, so a real block after it is never swallowed.
const FENCE = /^[ \t]*(```+|~~~+)[^\n]*\n[\s\S]*?\n[ \t]*\1[ \t]*(?=\n|$)/gm;
// Inline code: backticks on one line.
const INLINE = /`[^`\n]*`/g;

// Spaces of the same length, line breaks kept (so "at the start of a line" still reads the same around the span).
const blanked = found => found.replace(/[^\n]/g, ' ');

/**
 * `text` with its inline code and closed fenced code blanked to spaces (positions and line breaks unchanged).
 * A fence whose body has a line starting with the `tag` (open or close) is a block the model wrapped in a fence: it is left as it is, so the block is read.
 */
export function maskCode(text, tag = '') {
    const said = String(text ?? '');
    if (!said.includes('`') && !said.includes('~~~')) return said;
    const wrapped = tag ? new RegExp(`^[ \\t]*</?${escapeRe(tag)}(?:[ \\t>]|$)`, 'im') : null;
    return said.replace(FENCE, found => (wrapped && wrapped.test(found.slice(found.indexOf('\n') + 1)) ? found : blanked(found))).replace(INLINE, blanked);
}
