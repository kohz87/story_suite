// Story Director v2, tracker part (domain): reads and starts the reply being read's bookkeeping (`turn`).

import { slotIn, slotValue, toSlot } from '../../../rpg/slot.js';
import { isInt, isRecord } from './shared-guards.js';

/** What the reply being read has done so far (a blank before its first line). */
export function replyTurn(director) {
    const turn = director?.turn;
    // An older state kept these on `turn` itself.
    const now = isRecord(turn) && Object.hasOwn(turn, 'now') ? slotValue(turn.now) : isRecord(turn) && Object.hasOwn(turn, 'quests') ? turn : null;
    return {
        reply: now?.reply ?? null,
        index: isInt(now?.index) ? now.index : -1,
        from: isInt(now?.from) ? now.from : null,
        quests: Array.isArray(now?.quests) ? now.quests : [],
        lone: isRecord(now?.lone) ? now.lone : null,
        added: isInt(now?.added) ? now.added : 0,
        vouched: typeof now?.vouched === 'string' ? now.vouched : null,
        paid: isInt(now?.paid) && now.paid > 0 ? now.paid : 0,
        pending: Array.isArray(now?.pending) ? now.pending.filter(id => typeof id === 'string' && id) : [],
        refused: Array.isArray(now?.refused) ? now.refused.filter(entry => isRecord(entry) && typeof entry.id === 'string' && entry.id) : [],
        // The first story's-word turn-in (`vouched`) and the others the reader's limit let through (`words`).
        words: [...new Set([now?.vouched, ...(Array.isArray(now?.words) ? now.words : [])].filter(id => typeof id === 'string' && id))],
        intent: Array.isArray(now?.intent) ? now.intent.filter(id => typeof id === 'string' && id) : [],
        // The quests the story said were met in this reply (`met: yes` that set `ready`).
        met: Array.isArray(now?.met) ? now.met.filter(id => typeof id === 'string' && id) : [],
    };
}

/** The reply count (`turn.n`, v1's message number), 0 before any. */
export const turnNumber = director => (isInt(director?.turn?.n) && director.turn.n >= 0 ? director.turn.n : 0);

/** Starts the next reply's bookkeeping on a draft: `turn.n` one up, `now` fresh. Returns `now`. */
export function startReply(director, { reply, index }) {
    const now = { reply, index, from: director.time?.minutes ?? null, quests: [], lone: null, added: 0, vouched: null, paid: 0 };
    director.turn = { n: turnNumber(director) + 1, now: toSlot(now) };
    return director.turn.now[0];
}

/**
 * The reply being read's bookkeeping on a draft, to change in place (written whole: a slot), or null
 * before its first line. An older state's bare `turn` is moved into the slot first.
 */
export function replyDraft(director) {
    const turn = director?.turn;
    if (!isRecord(turn)) return null;
    if (!Object.hasOwn(turn, 'now')) {
        if (!Object.hasOwn(turn, 'quests')) return null;
        director.turn = { n: turnNumber(director), now: toSlot({ ...replyTurn(director) }) };
        return director.turn.now[0];
    }
    return slotIn(director.turn, 'now');
}
