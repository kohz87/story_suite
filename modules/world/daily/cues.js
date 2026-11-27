// World events: the must-happen death cue (spec v0.14.5 §8 Deaths, ruling 34). An event with even_in_party that kills someone with
// You leaves `dying` { by, text, day, rev, replies } on them in the step's state (cast.js); the world note tells the narrator's next
// reply "<name> dies here: <summary>". After each later reply: if the narrator wrote the death (NPC State's death line: `dead` holds
// the id), it is applied then; else the reply counts, and after 3 replies code applies it with a Journal line and a Problems note.
// The reply that made the cue does not count. Pure: the daily state in, a new one out (the host writes it whole, so replay repeats it).

import { recordAnchor } from './anchors.js';

export const CUE_REPLIES = 3;

/** The pending cues of the daily state: `[{ id, text, by }]` (for the world note). */
export function pendingCues(daily) {
    const cast = daily?.cast && typeof daily.cast === 'object' ? daily.cast : {};
    return Object.keys(cast).sort().filter(id => cast[id]?.dying && cast[id].died === undefined).map(id => ({ id, text: cast[id].dying.text, by: cast[id].dying.by }));
}

/**
 * After the reply `rev`: `{ daily, applied: [{ id, how: 'written' | 'fallback' }], journal, problem }`, or null when no cue is due
 * (none pending, or only cues this reply made). `dead`: the cast ids NPC State has recorded dead; `names`: id → name.
 */
export function settleCues(daily, { dead = new Set(), rev = 0, names = new Map() } = {}) {
    const due = pendingCues(daily).filter(cue => daily.cast[cue.id].dying.rev !== rev);
    if (!due.length) return null;
    const next = structuredClone(daily);
    const applied = [];
    const journal = [];
    for (const { id } of due) {
        const row = next.cast[id];
        const name = names.get(id) ?? id;
        const replies = (Number.isInteger(row.dying.replies) ? row.dying.replies : 0) + 1;
        const written = dead.has(id);
        if (!written && replies < CUE_REPLIES) { row.dying = { ...row.dying, replies }; continue; }
        const { dying, ...rest } = row;
        next.cast[id] = { ...rest, died: next.day };
        recordAnchor(next.anchors, `died:${id}`, next.day);
        applied.push({ id, how: written ? 'written' : 'fallback' });
        // A cue with no words for the cause is only "<name> dies here.": nothing to add in brackets.
        const cause = / dies here: /.test(dying.text) ? ` (${dying.text.replace(/^.*? dies here: /, '')})` : '';
        journal.push({ day: next.day, text: written ? `${name} died${cause}.` : `${name} died: the story did not show it within ${CUE_REPLIES} replies, so the world applied it.`, by: dying.by });
    }
    const late = applied.filter(item => item.how === 'fallback').map(item => names.get(item.id) ?? item.id);
    return { daily: next, applied, journal, problem: late.length ? `World: ${late.join(', ')} died off-screen; the narrator did not write the death within ${CUE_REPLIES} replies.` : '' };
}
