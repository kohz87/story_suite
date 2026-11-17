// Story Suite v2: dropDoubledDraft, the draft a model wrote into the reply before it wrote the reply again. Pure.

// A model sometimes thinks aloud in the reply itself with no <think> tag: its first paragraphs, then a review of them ("Wait, replace ...",
// word counts, a rule list ending "Ready to output."), then the whole story again, then the change block. The reader sees all of it. The
// real reply starts where the first paragraph comes back word for word, so what stands before that second copy is the draft and is dropped.
// Only a first paragraph of MIN_FIRST characters counts: a short line that comes round again (a refrain, a greeting) is never a draft.
const MIN_FIRST = 60;

/**
 * `mes` with a draft in front of a second copy of its own first paragraph dropped, or `mes` itself (the same string) when there is none.
 * Applied to a whole fresh reply only, never to a Continue's added text. Run again on the result it changes nothing, so a Re-read of the kept reply reads what the live capture kept.
 */
export function dropDoubledDraft(mes) {
    const text = String(mes ?? '');
    const start = text.length - text.trimStart().length;
    const stop = text.indexOf('\n\n', start);
    const first = (stop < 0 ? text.slice(start) : text.slice(start, stop)).trim();
    if (first.length < MIN_FIRST) return text;
    const again = text.indexOf(first, start + first.length);
    return again < 0 ? text : text.slice(0, start) + text.slice(again);
}
