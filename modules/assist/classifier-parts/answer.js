// Reading the classifier's answer: a check line, none, or a plain-sentence error.

import { extractBlock, parseChanges } from '../../../../../../core/capture.js';
import { clip } from '../common.js';
import { CHECK_KIND } from './names.js';
import { checkLine } from './check-line.js';

// `none`, `None.`, `none (just talk)`: the first word decides.
const NONE = /^\W*(?:none|no check)\b/i;

/**
 * The classifier's answer read with Story Block's change-line parser:
 * { line } (the first check line), { none: true }, or { error } (a plain sentence) for anything else.
 */
export function parseClassifierAnswer(answer) {
    const text = String(answer ?? '').trim();
    if (!text) return { error: 'the answer was empty' };
    const body = extractBlock(text) ?? text;
    const { lines } = parseChanges(body);
    for (const parsed of lines) {
        if (parsed.op !== '?' || parsed.kind !== CHECK_KIND) continue;
        const line = checkLine(parsed);
        if (line) return { line };
        return { error: `"${parsed.raw}" is not a usable check line (a skill word and dc: easy, normal, hard or a number)` };
    }
    const first = body.split(/\r?\n/).map(part => part.replace(/\*\*|`/g, '').trim()).find(Boolean) ?? '';
    if (NONE.test(first)) return { none: true };
    return { error: `"${clip(first, 80)}" is neither a check line nor none` };
}
