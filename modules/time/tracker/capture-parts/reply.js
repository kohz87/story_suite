// Story Director v2, tracker part: which reply a line comes from and the reply's bookkeeping a line starts or joins.

import { replyDraft, replyTurn, startReply } from '../domain.js';

/** The revision this command commits as (`ctx.rev`, MODULES §F2), 0 when the host does not say. */
export function revOf(ctx) {
    return Number.isSafeInteger(ctx?.rev) ? ctx.rev : 0;
}

/**
 * The reader's own message the reply answers (the capture ctx's `ctx.chat.lastUser`), or null.
 * v1's gate: giving a quest up is the reader's choice, and only their message can make it.
 */
export function readerSaid(ctx) {
    const said = ctx?.chat?.lastUser ?? null;
    return typeof said === 'string' ? said : null;
}

// The capture ctx's carrier `{ index, swipe, sid, key }` as one plain value: its sid, else its key, else
// "index:swipe" (a swipe of the same reply is another reply), else a bare index or key.
function carrierKey(value) {
    if (value && typeof value === 'object') {
        // The reply's record ID (`sid`) stays with it when an earlier message is deleted; `key` does not.
        if (typeof value.sid === 'string' && value.sid) return value.sid;
        if (typeof value.key === 'string' && value.key) return value.key;
        if (Number.isSafeInteger(value.index)) return `${value.index}:${Number.isSafeInteger(value.swipe) ? value.swipe : 0}`;
        return null;
    }
    return Number.isSafeInteger(value) || (typeof value === 'string' && value) ? value : null;
}

// Whether the reply's key is the host's record ID (`sid`), which a Continue keeps.
function hasSid(ctx, line) {
    const value = [ctx?.carrier, line?.carrier].find(item => carrierKey(item) !== null);
    return Boolean(value) && typeof value === 'object' && typeof value.sid === 'string' && value.sid !== '';
}

// Which reply a line comes from: the host's carrier (`ctx.carrier`), else read from the line's
// place in its block (a first line, or one not after the last line read, starts a reply).
function replyOf(ctx, line) {
    for (const value of [ctx?.carrier, line?.carrier]) {
        const key = carrierKey(value);
        if (key !== null) return key;
    }
    return null;
}

/**
 * Moves `director.turn` on when `line` starts another reply's Director lines. Returns the reply's
 * bookkeeping (`turn.now`) to change in place: it is written whole with the line (domain.js).
 */
export function beginTurn(director, ctx, line) {
    const { fresh, place } = turnOf(director, ctx, line);
    const now = fresh ? null : replyDraft(director);
    if (!now) return startReply(director, { reply: replyOf(ctx, line), index: place });
    if (now.index !== place) now.index = place;
    return now;
}

// Whether `line` starts another reply's Director lines (`fresh`), and the place kept for it (beginTurn).
function turnOf(director, ctx, line) {
    const turn = replyTurn(director);
    const reply = replyOf(ctx, line);
    const index = Number.isSafeInteger(line?.index) ? line.index : -1;
    // B-a1-6: the reply's record ID (`sid`) is kept by its Continues (and the extractor's late lines),
    // whose lines are numbered from 0 again, so with a sid only another sid starts a reply: maxJump,
    // `turn.n` and the reply's tallies (paid, added, vouched) hold for the reply and its Continues. A
    // Re-read starts from the state before the reply and a swipe has its own sid, so both start fresh.
    // A host with no sid is told apart by the line's place in its block, as before; with a sid the place
    // is not kept (-1), so a Continue's lines, numbered again, and a Re-read's leave the same turn.
    const sid = reply !== null && hasSid(ctx, line);
    const fresh = sid ? reply !== turn.reply
        : reply !== null ? reply !== turn.reply || (index >= 0 && index <= turn.index)
            : index <= 0 || index <= turn.index;
    return { fresh, place: sid ? -1 : index };
}
