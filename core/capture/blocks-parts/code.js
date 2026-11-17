// Story Suite v2: the code spans of a reply (inline `code`, closed fenced blocks), blanked so a tag named inside them is not read as a block.

// A closed fenced block (``` or ~~~ at a line start, the same fence closing it); an unclosed fence is left alone, so a real block after it is never swallowed.
const FENCE = /^[ \t]*(```+|~~~+)[^\n]*\n[\s\S]*?\n[ \t]*\1[ \t]*(?=\n|$)/gm;
// Inline code: backticks on one line.
const INLINE = /`[^`\n]*`/g;

// Spaces of the same length, line breaks kept (so "at the start of a line" still reads the same around the span).
const blanked = found => found.replace(/[^\n]/g, ' ');

/** `text` with its inline code and closed fenced code blanked to spaces (positions and line breaks unchanged). */
export function maskCode(text) {
    const said = String(text ?? '');
    if (!said.includes('`') && !said.includes('~~~')) return said;
    return said.replace(FENCE, blanked).replace(INLINE, blanked);
}
