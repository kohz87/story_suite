// Reading the kinds' grammar lines: the kind a line is about and the lines of the allowed kinds.

/** The kind word a grammar line is about (`+ item Name | qty: 1` → 'item'), or null. */
export function grammarKind(line) {
    const match = /^\s*[+\-~!?]\s*(\p{L}[\p{L}\p{N}_-]*)/u.exec(String(line ?? ''));
    return match ? match[1].toLowerCase() : null;
}

/** The grammar lines of the kinds `allow` (allowedKinds) names any op of. */
export function allowedGrammar(lines, allow) {
    const kinds = new Set([...allow].map(key => key.split(' ')[1]));
    return lines.filter(line => kinds.has(grammarKind(line)));
}
