// Story Director v2, part **keypeople**: adds one note for a reply's card, keeping only the newest replies' notes.

import { idFrom } from '../../writes.js';
import { MAX_NOTE_REPLIES, cutPoints } from '../domain.js';
import { revOf } from './shared-ctx.js';

// One note for the reply's card (and its closed line): a new key each time, never changed after. `lead`: the first of its reply.
// `key` and `goneRev` (a removal told after the step that made it, `keypeople.tell`): the taken-off record it is about, so the card
// says nothing when that record is not there any more (the reply that made it was deleted).
export function addNote(ctx, kp, { kind, name, head, rest, key, goneRev }) {
    const sid = ctx.carrier?.sid ?? ctx.reply?.sid ?? null;
    const rev = revOf(ctx);
    const same = note => note.sid === sid && (sid !== null || note.rev === rev);
    const id = idFrom(ctx, 'kn', kp.notes);
    kp.notes[id] = { sid, kind, name, head: cutPoints(head, 200), rest: cutPoints(rest, 300), lead: !Object.values(kp.notes).some(same), rev, ...(key !== undefined ? { key, goneRev } : {}) };
    // The newest replies' notes only: whole replies go, oldest first, so a reply never loses its lead.
    const order = [];
    for (const [other, note] of Object.entries(kp.notes)) {
        const mark = `${note.sid ?? ''}|${note.sid === null ? note.rev : ''}`;
        let group = order.find(entry => entry.mark === mark);
        if (!group) order.push(group = { mark, ids: [] });
        group.ids.push(other);
    }
    for (const group of order.slice(0, Math.max(0, order.length - MAX_NOTE_REPLIES))) for (const old of group.ids) delete kp.notes[old];
}
