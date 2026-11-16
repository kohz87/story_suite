// Story Suite v2: reading the change lines of a v1 envelope as the reply's block when it has none.

import { readBlocks, replacePairs, blank } from '../blocks.js';
import { MAX_LINE, parseLine } from '../lines.js';
import { sameLine } from '../echo.js';
import { HAS_LEGACY, legacyPairs, cutPairs } from './pairs.js';

/**
 * A reply's v1 envelopes, from `at.from` on (a Continue's own text), before it is read: when the reply has no block of
 * its own (bare or kept; with `at`, none the Continue added), the change lines in them become its block, in the place
 * of the first one, each once; otherwise they are taken out and never read. → { text, legacy }: legacy 'read' (lines
 * were taken), 'ignored' (envelopes taken out), or null (none; `text` is `mes`).
 */
export function adoptLegacy(mes, { tag = 'Changes', at = null } = {}) {
    const text = String(mes ?? '');
    if (!HAS_LEGACY.test(text)) return { text, legacy: null };
    const from = Math.max(0, Math.min(text.length, at?.from ?? 0));
    const pairs = legacyPairs(text).filter(pair => pair.start >= from);
    if (!pairs.length) return { text, legacy: null };
    const own = readBlocks(replacePairs(text, pairs, blank), tag, at).length > 0;
    const lines = new Map();
    if (!own) {
        for (const pair of pairs) {
            const body = text.slice(pair.bodyStart, pair.bodyEnd);
            // (An envelope left open may end in the middle of its last line: that one is left out.)
            const rows = body.split('\n').slice(0, pair.open && !body.endsWith('\n') ? -1 : undefined);
            for (const row of rows) {
                const line = row.trim();
                if (line && line.length <= MAX_LINE && !parseLine(line).error && !lines.has(sameLine(line))) lines.set(sameLine(line), line);
            }
        }
    }
    if (!lines.size) return { text: cutPairs(text, pairs, from), legacy: 'ignored' };
    const block = `<${tag}>\n${[...lines.values()].join('\n')}\n</${tag}>`;
    return { text: cutPairs(text, pairs, from, (_, i) => (i === 0 ? block : '')), legacy: 'read' };
}
