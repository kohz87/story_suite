// The extractor's prompt for one reply: the heads, the grammar, where the scene is, its own lines, then the reply.

import { clip } from '../common.js';
import { whereLines } from '../where.js';
import { EXTRACTOR_HEAD, REPLY_HEAD, WHERE_HEAD, WRITTEN_HEAD } from './heads.js';
import { footFor } from './foot.js';

export const REPLY_LIMIT = 6000;

/**
 * The extractor's prompt for `reply` (the story text, block removed), the kinds' grammar lines and the
 * reply's own change lines (`written`, raw): the head and grammar first (fixed while the same kinds are
 * on, for a provider's prompt cache), then where and when the scene is (`around`, where.js whereNow: the
 * place, the known places near it, the story date and time; left out when nothing is known), then the
 * reply's lines, then the reply.
 */
export function extractorPrompt(reply, grammar, written = [], around = null) {
    const kinds = grammar.map(line => `- ${String(line).trim()}`).join('\n');
    const own = written.length ? written.map(line => clip(line, 200)).join('\n') : 'none';
    const where = whereLines(around);
    return `${EXTRACTOR_HEAD}\n${kinds}\n${footFor(grammar)}\n\n${where.length ? `${WHERE_HEAD}\n${where.join('\n')}\n\n` : ''}${WRITTEN_HEAD}\n${own}\n\n${REPLY_HEAD}\n"""\n${clip(reply, REPLY_LIMIT)}\n"""`;
}
