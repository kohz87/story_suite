// Story Suite v2: dropDoubledDraft, the draft a model wrote into the reply before it wrote the reply again. Pure.

// A model sometimes thinks aloud in the reply itself with no <think> tag: its first paragraphs, then a review of them ("Wait, replace ...",
// word counts, a rule list ending "Ready to output."), then the whole story again, then the change block. The reader sees all of it.
// The real reply starts where the first paragraph comes back, so what stands before that second copy is the draft and is dropped. A second
// copy counts only when it is a repeat of the whole reply, not a refrain or a flashback that reopens on the opening words:
//  - the whole first paragraph (MIN_FIRST characters or more) comes back and ends a paragraph (a blank line, the block or the end follows);
//  - what follows it (up to the change block) is a near-whole repeat of the text before it: AFTER_IN_BEFORE of its word runs were already
//    written, and BEFORE_IN_AFTER of the text before reappears (the review is the part that does not).
const MIN_FIRST = 60;
const RUN = 4;
const AFTER_IN_BEFORE = 0.8;
const BEFORE_IN_AFTER = 0.6;

function runs(text) {
    const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const set = new Set();
    for (let i = 0; i + RUN <= words.length; i++) set.add(words.slice(i, i + RUN).join(' '));
    return set;
}

function shared(from, into) {
    let count = 0;
    for (const run of from) if (into.has(run)) count++;
    return from.size ? count / from.size : 0;
}

function repeats(before, after) {
    const story = after.replace(/(?:<Changes>|<!--)[\s\S]*$/i, '');
    const was = runs(before);
    const now = runs(story);
    return now.size > 0 && shared(now, was) >= AFTER_IN_BEFORE && shared(was, now) >= BEFORE_IN_AFTER;
}

/**
 * `mes` with a draft in front of a second copy of its own reply dropped, or `mes` itself (the same string) when there is none.
 * Applied to a whole fresh reply only, never to a Continue's added text. Run again on the result it changes nothing, so a Re-read of the kept reply reads what the live capture kept.
 */
export function dropDoubledDraft(mes) {
    const text = String(mes ?? '');
    const start = text.length - text.trimStart().length;
    const stop = text.indexOf('\n\n', start);
    const first = (stop < 0 ? text.slice(start) : text.slice(start, stop)).trim();
    if (first.length < MIN_FIRST) return text;
    for (let again = text.indexOf(first, start + first.length); again >= 0; again = text.indexOf(first, again + 1)) {
        const rest = text.slice(again + first.length);
        if (!/^(?:\s*$|\n\n|\s*(?:<Changes>|<!--))/i.test(rest)) continue;
        if (repeats(text.slice(start, again), text.slice(again))) return text.slice(0, start) + text.slice(again);
    }
    return text;
}
