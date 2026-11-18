// A test helper: the change lines of one reply that the code did not apply, read straight from the turn's problems
// ({ index, line?, code, message, quiet? }). Same rules the old reply notes used, so tests read the engine's problems, not a card.

import { STRINGS, fill } from '../../core/strings.js';

/** The reason part of a problem about a change line (its message without the line itself). */
export function problemReason(item) {
    const message = String(item?.message ?? '').replace(/^\(assist[^)]*\)\s*/, '');
    const line = typeof item?.line === 'string' ? item.line : null;
    if (line) {
        const prefix = `"${line}" was not used: `;
        if (message.startsWith(prefix)) return message.slice(prefix.length) || 'This line was not used.';
    }
    if (item?.code === 'UNKNOWN_KIND') {
        const kind = /^No module keeps "([^"]*)"/.exec(message)?.[1];
        if (kind !== undefined) return fill(STRINGS.card.unknownKind, { kind });
    }
    if (!line || !message.includes(`"${line}"`)) return message || 'This line was not used.';
    return message.split(`"${line}"`).join('').replace(/\s+/g, ' ').replace(/^\s*(?:was not used\s*[:,.]?\s*)/i, '').replace(/^[\s,:;.—-]+/, '').trim() || 'This line was not used.';
}

const isWarning = item => item?.code === 'LIMITED' && typeof item.line === 'string' && item.line !== '';

/** The lines of reply `index` that were not applied: [{ line, reason }] in the order reported (quiet problems and applied-with-warning lines are skipped). */
export function refusedFrom(problems, index) {
    const out = [];
    for (const item of Array.isArray(problems) ? problems : []) {
        if (!item || item.index !== index || item.quiet === true || isWarning(item)) continue;
        if (typeof item.line === 'string' && item.line) out.push({ line: item.line, reason: problemReason(item) });
        else if (item.code === 'UNREADABLE' && item.message) out.push({ line: String(item.message), reason: '' });
    }
    return out;
}
