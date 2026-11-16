// Proof evidence payloads, intent: whether the reader's words or pick are what an acceptance proof claims.

// Folded for comparing: Unicode compatibility form, one space between words, lower case.
const fold = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
// The end marks of a sentence, and what may stand at a sentence's ends without being part of it (quotes, commas, dashes).
const SENTENCE_END = /[.!?\u2026\u3002\uff01\uff1f;\n\r]+/u;
const EDGE = /^[\s"'\u201c\u201d\u2018\u2019\u00ab\u00bb.!?\u2026\u3002\uff01\uff1f,:;\-\u2013\u2014()[\]*_~]+|[\s"'\u201c\u201d\u2018\u2019\u00ab\u00bb.!?\u2026\u3002\uff01\uff1f,:;\-\u2013\u2014()[\]*_~]+$/gu;
const core = text => fold(text).replace(EDGE, '');

/**
 * The sentences of the reader's message, folded and without their edges: the text cut at . ! ? … ; and line breaks.
 * A comma does not end one ("Sure, I accept the job" is one sentence).
 */
export function sentences(text) {
    // Cut first (a line break is a sentence end), then fold each piece: folding first would turn the break into a space.
    return String(text ?? '').normalize('NFKC').split(SENTENCE_END).map(piece => fold(piece).replace(EDGE, '')).filter(Boolean);
}

/**
 * '' when the host saw the reader's intent the proof claims, else why not (REFUSED). An acceptance by
 * `selection` is the reader's own action in a screen (cause `ui`). One by `words` must be a whole sentence of the
 * reader's message the host gave this reply (`chat.lastUser`: the message right before the reply), after folding
 * case, spacing and the marks at its ends, and at least two words: a piece of a sentence ("take it" out of "I will
 * not take it"), one word ("No") or text only the narration (`chat.reply`) says is REFUSED. The host proves
 * quoting, not meaning: whether the quoted sentence accepts is the owner's to judge.
 */
export function intentProblem(kind, payload, { cause, chat }) {
    if (kind !== 'acceptance') return '';
    if (Object.hasOwn(payload, 'selection')) {
        return cause === 'ui' ? '' : 'a selection is the reader\'s own pick in a screen, and this did not come from one';
    }
    const spoken = sentences(chat?.lastUser);
    if (!chat || !spoken.length) return 'the host saw no message from the reader for this reply, and narration cannot accept for them';
    const quoted = core(payload.words);
    if (quoted.split(' ').length < 2) return 'the reader\'s words are at least two words';
    return spoken.includes(quoted) ? '' : 'the words are not a whole sentence of the reader\'s message the host saw (narration cannot accept for the reader, and a piece of a sentence is not what they said)';
}
