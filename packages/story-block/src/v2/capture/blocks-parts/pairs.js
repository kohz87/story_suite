// Story Suite v2: the one-pass scanners for closed open/close pairs in a text, and blanking or replacing them.

/**
 * Every closed pair in `text` in one pass: an open (`openRe`, global), then the first close after it
 * (`closeRe`, global), then on from there. An open with no close after it ends the search, since no
 * later open has one either. → [{ start, end, bodyStart, bodyEnd }].
 */
export function closedPairs(text, openRe, closeRe) {
    const out = [];
    let at = 0;
    while (at < text.length) {
        openRe.lastIndex = at;
        const open = openRe.exec(text);
        if (!open) break;
        closeRe.lastIndex = openRe.lastIndex;
        const close = closeRe.exec(text);
        if (!close) break;
        out.push({ start: open.index, end: closeRe.lastIndex, bodyStart: openRe.lastIndex, bodyEnd: close.index });
        at = closeRe.lastIndex;
    }
    return out;
}

// `text` with each pair put back as `fn(pair)` gives.
export function replacePairs(text, pairs, fn) {
    let out = '';
    let at = 0;
    for (const pair of pairs) {
        out += text.slice(at, pair.start) + fn(pair);
        at = pair.end;
    }
    return out + text.slice(at);
}

export const blank = pair => ' '.repeat(pair.end - pair.start);
