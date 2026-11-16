// Reads the stray-line heads and grammar line a capture kind declares.

/**
 * `hostVersion`: this Story Block's version (runtime.js HOST_VERSION), checked against each module's
 * `requires.storyBlock`; null skips that check (a registry built outside the host).
 * `warn(message)`: where definition warnings and failed initial() calls go (default console.warn).
 */
/** The heads a kind names for stray lines (`heads`: ['+ event', '- event']): only well-formed "op kind" strings; [] for none. */
export function headsOf(spec) {
    return Array.isArray(spec?.heads) ? spec.heads.filter(head => typeof head === 'string' && /^[+\-~!?] \p{L}[\p{L}\p{N}_-]*$/u.test(head)) : [];
}

/**
 * A capture kind's grammar line: its text, or what its function answers now (one line of text; '' when it answers anything else).
 * `hint` (optional) is what the prompt being built tells the function (prompt.js assemble: { view, rolled }); without it the line is the full one.
 */
export function grammarOf(spec, hint) {
    let line = spec?.grammar;
    if (typeof line === 'function') {
        try { line = line(hint); } catch { line = ''; }
    }
    line = typeof line === 'string' ? line.trim() : '';
    return /\n/.test(line) ? '' : line;
}
