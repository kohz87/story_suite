// The reply notes' wording of a refused or warned change line: its reason, and the lists a reply's turn problems make.

import { STRINGS, fill } from '../../../core/strings.js';

/**
 * The reason part of a turn problem about a change line (its message without the line itself). Any message gives a readable
 * reason: the safety net's "(assist) " mark is dropped, "<line> was not used: why" is cut at the colon, an unknown kind keeps its friendly
 * text, and any other message loses the quoted line and keeps the rest.
 */
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

/** A LIMITED problem that names a line: the line was applied (money-guard warning, or a clamp the owner explains). */
const isWarning = item => item?.code === 'LIMITED' && typeof item.line === 'string' && item.line !== '';

/** The warnings about lines of reply `index` that WERE applied: [{ line, reason }] (the card's "applied, check:"). */
export function warnedFrom(problems, index) {
    const out = [];
    for (const item of Array.isArray(problems) ? problems : []) {
        if (item && item.index === index && item.quiet !== true && isWarning(item)) out.push({ line: item.line, reason: problemReason(item) });
    }
    return out;
}

/**
 * The change lines of reply `index` the code did not apply, from turn problems
 * (`{ index, line?, code, message, quiet? }`): [{ line, reason }] in the order reported. A problem without a
 * line (a block that could not be read) is listed by its message; a quiet one (FEATURE_OFF) is not listed.
 */
export function refusedFrom(problems, index) {
    const out = [];
    for (const item of Array.isArray(problems) ? problems : []) {
        // A quiet problem (a line of a feature the reader turned off) is not a refusal; nor is a warning about a line that was applied.
        if (!item || item.index !== index || item.quiet === true || isWarning(item)) continue;
        if (typeof item.line === 'string' && item.line) out.push({ line: item.line, reason: problemReason(item) });
        else if (item.code === 'UNREADABLE' && item.message) out.push({ line: String(item.message), reason: '' });
    }
    return out;
}
