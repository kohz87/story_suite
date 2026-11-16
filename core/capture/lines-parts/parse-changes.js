// Story Suite v2: parsing a block's text into change lines and problems, line by line.

import { cutAt } from '../../text.js';
import { MAX_LINE } from './shared-text.js';
import { parseLine } from './parse-line.js';
import { stripCaretWords } from './decoration.js';

// What a model writes when it had nothing to change; dropped quietly.
export const NOTHING = /^\(?\s*(?:none|no changes?|nothing(?: changed)?|n\/a)\s*\)?\.?$/i;

/**
 * Parses change lines, one per line. Blank lines, code fences, the block's own tags and "none"
 * are skipped; any other line that is not a change goes to `problems` as a plain sentence.
 * Returns { lines: [{ op, kind, name, text, labels, raw, index }], problems: string[], over? }; `index`
 * is the line's place among the lines read (0-based), `raw` the line as written. With `max`, at most
 * that many written lines (change lines or not) are read; `over` = { count, total, first } tells the rest.
 * With `caret`, the ^ a preset puts in front of each word is dropped first (stripCaretWords); `raw` is then the line without them.
 */
export function parseChanges(text, { max = Infinity, caret = false } = {}) {
    const lines = [];
    const problems = [];
    const sources = String(text ?? '').split(/\r?\n/);
    let read = 0;
    let over = null;
    for (let number = 0; number < sources.length; number += 1) {
        const raw = sources[number].trim();
        if (!raw || raw.startsWith('```') || raw.startsWith('~~~') || /^<\/?[A-Za-z_]+\s*>$/.test(raw) || NOTHING.test(raw)) continue;
        // Every line written counts against `max`, read or not (B-b5b-robust-r2-5): past it the rest are
        // counted, not read, and told once (`over`).
        read += 1;
        if (read > max) {
            over ??= { first: raw, count: 0 };
            over.count += 1;
            continue;
        }
        if (raw.length > MAX_LINE) {
            problems.push(`Line ${number + 1} "${cutAt(raw, 60)}…" is longer than ${MAX_LINE} characters, so it was not read.`);
            continue;
        }
        const parsed = parseLine(raw, { caret });
        if (parsed.error) problems.push(`Line ${number + 1} "${raw}" is not a change line: ${parsed.error}.`);
        else lines.push({ ...parsed, raw: caret ? stripCaretWords(raw) : raw, index: lines.length });
    }
    return over ? { lines, problems, over: { ...over, total: read } } : { lines, problems };
}
