// Adding a lie the story told, keeping the list within its cap.
import { LIES_MAX, LIE_TO_MAX, LIE_SAID_MAX, LIES_TEXT_MAX } from './shared-limits.js';
import { ID_MAX, clip, sameName } from './shared-text.js';
import { replyOk, dayOk } from './shared-valid.js';
import { listOf } from './read.js';

// Over the cap, the oldest caught lie goes first; with none caught, the oldest lie goes.
export function capped(list) {
    const out = [...list];
    while (out.length > LIES_MAX) {
        const caughtAt = out.findIndex(item => item.caught);
        out.splice(caughtAt >= 0 ? caughtAt : 0, 1);
    }
    return out;
}

/**
 * A lie the story told: { text, entry, changed, problem }. `text` is the whole new leaf (the prior text when nothing changed).
 * A Re-read of the same reply replaces its own entry (id = reply, person and words, and a caught stamp is kept). The same words
 * to the same person on the same day, from another reply, are a no-op. Without who it was told to, what was said, or a valid
 * day and reply, nothing is written and `problem` says why.
 */
export function addLie(prior, { to, said, day = null, r } = {}) {
    const teller = clip(to, LIE_TO_MAX);
    const words = clip(said, LIE_SAID_MAX);
    const refuse = problem => ({ text: prior, entry: null, changed: false, problem });
    if (!teller || !words) return refuse('A lie needs who it was told to and what was said.');
    if (!dayOk(day) || !replyOk(r)) return refuse('A lie needs a valid story day and reply.');
    const before = listOf(prior);
    const id = `${String(r)}:${teller}:${words}`.slice(0, ID_MAX);
    const old = before.find(item => item.id === id);
    const kept = before.filter(item => item.id !== id);
    if (kept.some(item => !item.caught && sameName(item.to, teller) && item.said === words && item.day === day)) return refuse('');
    const entry = { id, to: teller, said: words, day, r };
    if (old?.caught) entry.caught = { ...old.caught };
    const next = JSON.stringify(capped([...kept, entry]));
    if (next.length > LIES_TEXT_MAX) return refuse('The lies are too long to record.');
    return { text: next, entry, changed: true, problem: '' };
}
