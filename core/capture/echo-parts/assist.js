// Story Suite v2: the Assist extractor's stored output: reading its sections and writing them into a hidden comment.

import { cutAt } from '../../text.js';
import { withoutReasoning, hiddenPairs, commentParts, sectionTags, replacePairs, HIDDEN_MARKER, commentSafe } from '../blocks.js';
import { MAX_LINE, trimEnd } from '../lines.js';

/**
 * The Assist extractor's stored output in `mes` (MODULES §F100, §F123): { now, next }, the lines of every
 * hidden comment's <Changes-assist> section (applied on this reply) and <Changes-assist-next> section (read
 * from this reply after the reader had sent; the next reply applies them), in order. Never read as the
 * reply's own block (extractBlock leaves sections out), so Re-read and replay take them from here.
 */
const REPAIRED = 'repaired';
const DISCARDED = 'discarded';

export function assistSections(mes, tag = 'Changes') {
    const text = withoutReasoning(String(mes ?? ''));
    const now = [];
    const next = [];
    for (const pair of hiddenPairs(text)) {
        const parts = commentParts(text, pair, tag);
        now.push(...parts.assist);
        next.push(...parts.next);
    }
    return { now, next };
}

/**
 * `mes` with `lines` kept as the Assist extractor's output, in a hidden comment of their own at the end:
 * a <Changes-assist> section, or with `next` a <Changes-assist-next> one. Hidden like a block (stripBlock
 * takes it out of the shown text and the prompt history); no line is ever read from it as the reply's own. `repair`: the lines are the repair's
 * (repair.js), so the comment's header says `repaired` and repairState / withoutRepair can tell them from the safety net's.
 */
export function withAssist(mes, lines, { next = false, tag = 'Changes', repair = false } = {}) {
    const list = (lines ?? []).map(line => cutAt(String(line ?? '').replace(/[\r\n]+/g, ' ').trim(), MAX_LINE)).filter(Boolean);
    const text = String(mes ?? '');
    if (!list.length) return text;
    const name = sectionTags(tag)[next ? 'next' : 'assist'];
    return `${trimEnd(text)}\n\n<!-- ${HIDDEN_MARKER}${repair ? ` ${REPAIRED}` : ''}\n<${name}>\n${commentSafe(list.join('\n'))}\n</${name}>\n-->`;
}

/** What `mes` holds of a repair (repair.js): 'repaired' (a comment with the repair's lines), 'discarded' (the reader discarded them; the repair is not asked again) or ''. */
export function repairState(mes) {
    const text = withoutReasoning(String(mes ?? ''));
    const heads = hiddenPairs(text).map(pair => commentParts(text, pair).head);
    if (heads.some(head => head.has(DISCARDED))) return DISCARDED;
    return heads.some(head => head.has(REPAIRED)) ? REPAIRED : '';
}

/** `mes` without the repair's comment, and with the mark that it was discarded (so a reload, a swipe back and a Re-read never ask the repair again). The safety net's lines stay. */
export function withoutRepair(mes) {
    const text = String(mes ?? '');
    const kept = replacePairs(text, hiddenPairs(text), pair => (commentParts(text, pair).head.has(REPAIRED) ? '' : text.slice(pair.start, pair.end)));
    return repairState(kept) === DISCARDED ? trimEnd(kept) : `${trimEnd(kept)}\n\n<!-- ${HIDDEN_MARKER} ${DISCARDED}\n-->`;
}
