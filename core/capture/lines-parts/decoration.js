// Story Suite v2: stripping the markdown and bullet decoration a model puts around a change line, and the line's body after its kind.

export function stripMarkdown(text) {
    return String(text ?? '').replace(/\*\*|__|`/g, '');
}

// A run of ^ at the very start of a line is decoration too (a preset may mark lines with it); a ^ elsewhere stays.
// A bullet, number or quote mark in front of a line is decoration. A hyphen counts as one only
// when an op follows it: `- item Rope` is itself an op.
export function stripDecoration(line) {
    return line
        .replace(/^\^+\s*/, '')
        .replace(/^>\s*/, '')
        .replace(/^(?:[*•·]\s+|\d+[.)]\s+)/, '')
        .replace(/^-\s+(?=[+\-~!?]\s)/, '');
}

// A preset that marks every word with ^ ("^+ ^item ^Rope ^| ^qty: ^1"): the ^ in front of each word is decoration too. Only a line that
// starts with ^ is touched, and only a ^ at the start of a word, so a ^ inside a word or a line that does not start with one stays.
// Read only under the `caretWords` rule mark (turn/rule-marks.js): an older reply's Re-read keeps reading such a line as unreadable.
export function stripCaretWords(line) {
    const text = String(line ?? '').trim();
    return text.startsWith('^') ? text.replace(/(^|\s)\^+(?=\S)/g, '$1') : text;
}

/**
 * A change line's text after its op and kind, as written (bold, backticks and a bullet in front are
 * decoration; a colon after the kind is drift): the whole of what a display kind shows (extras.js).
 */
export function lineBody(raw) {
    const line = stripDecoration(stripMarkdown(raw).trim()).trim();
    return line.replace(/^[+\-~!?]\s*\p{L}[\p{L}\p{N}_-]*\s*:?\s*/u, '');
}
