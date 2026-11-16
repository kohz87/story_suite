// Story Suite v2: the reasoning spans (and copies of the hidden marker) that a scan must leave out.

import { closedPairs, replacePairs, blank } from './pairs.js';
import { hiddenPairs, HIDDEN_OPEN } from './marker.js';

// Reasoning a model writes in the reply itself (<think>, <thinking>, <reasoning>): a draft of the
// change block inside it is not the change block, so a reply that drafts it there and writes it
// again at the end is read once. A pair that does not match (`<thinking>…</think>`, as some models
// write) is reasoning too. C2-3: an open tag with no close after it (a reply cut off mid-thought)
// is reasoning to the end of the reply, so nothing drafted inside it applies; a block written
// before it is kept. The end is Story Suite's own hidden comment when one comes after it (hideBlock
// writes it at the end, after the reasoning; a model's copy of the marker is defanged when the reply
// is read, defangMarker), so Re-read reads what was kept.
// Opens and closes found apart, in one pass (closedPairs), so many unclosed tags cost no more than
// the text's length (B-b5b-robust-r2-4).
const REASONING_OPEN = /<(?:think|thinking|reasoning)(?:[ \t][^>\n]{0,200})?>/gi;
const REASONING_CLOSE = /<\/(?:think|thinking|reasoning)\s*>/gi;
export function reasoningPairs(text) {
    const pairs = closedPairs(text, REASONING_OPEN, REASONING_CLOSE);
    REASONING_OPEN.lastIndex = pairs.length ? pairs.at(-1).end : 0;
    const open = REASONING_OPEN.exec(text);
    if (!open) return pairs;
    const hidden = hiddenPairs(text).find(pair => pair.start >= REASONING_OPEN.lastIndex);
    const end = hidden ? hidden.start : text.length;
    return [...pairs, { start: open.index, end, bodyStart: REASONING_OPEN.lastIndex, bodyEnd: end, open: true }];
}

/** `mes` without its reasoning (closed blocks, and an unclosed one to the end). */
export function withoutReasoning(mes) {
    const text = String(mes ?? '');
    return replacePairs(text, reasoningPairs(text), () => '');
}

// `text` with its reasoning blanked to spaces of the same length, so the positions of what is
// outside it stay where they are.
export const maskReasoning = text => replacePairs(text, reasoningPairs(text), blank);

/**
 * C2-7: `mes` with every copy of Story Suite's hidden marker from `from` on defanged (an `_` after it),
 * so text a model wrote that looks like the hidden comment is read as the plain comment it is, live
 * and on Re-read alike. Only the comment hideBlock writes carries the marker.
 */
export function defangMarker(mes, from = 0) {
    const text = String(mes ?? '');
    const at = Math.max(0, Math.min(text.length, from | 0));
    return text.slice(0, at) + text.slice(at).replace(HIDDEN_OPEN, found => `${found}_`);
}
