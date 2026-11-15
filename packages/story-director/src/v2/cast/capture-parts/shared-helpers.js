// Story Director v2, part **cast**: shared validation, note-recording, and cause-guard helpers for cast steps.

import { idFrom } from '../../writes.js';
import { MAX_KEY, MAX_NOTE_REPLIES, cutPoints, isInt } from '../domain.js';

const revOf = ctx => (isInt(ctx?.rev) ? ctx.rev : 0);
const nowOf = ctx => {
    try {
        const minutes = typeof ctx?.time === 'function' ? ctx.time() : null;
        return isInt(minutes) ? minutes : null;
    } catch {
        return null;
    }
};

// The JSON pointer of one person, inside the domain.
const personPath = key => `/people/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;

// One note for the reply's card: a new key each time, never changed after. A step is stored on the reply before the one it is for (the
// head when the hook runs), so a note names the message its card goes under (`at`: the chat's length when it was decided, which is the
// new reply's index), not the reply that holds the step.
function addNote(ctx, cast, at, { kind, head, tag, rest, line }) {
    const rev = revOf(ctx);
    const id = idFrom(ctx, 'cn', cast.notes);
    cast.notes[id] = { at: isInt(at) && at >= 0 ? at : 0, kind, head: cutPoints(head, 200), tag: cutPoints(tag, 120), rest: cutPoints(rest, 600), line: cutPoints(line, 200), rev };
    // The newest replies' notes only: all the notes of a reply go together, the oldest replies first.
    const places = [...new Set(Object.values(cast.notes).map(note => note.at))].sort((a, b) => a - b);
    const keep = new Set(places.slice(Math.max(0, places.length - MAX_NOTE_REPLIES)));
    for (const [other, note] of Object.entries(cast.notes)) if (!keep.has(note.at)) delete cast.notes[other];
}

export const textOk = (value, max) => typeof value === 'string' && Array.from(value).length <= max;
export const keyOk = value => typeof value === 'string' && value.length > 0 && value.length <= MAX_KEY;

export function envOf(ctx, cast, packNames = {}, at = null) {
    return {
        now: nowOf(ctx), rev: revOf(ctx),
        touch: key => { if (typeof ctx.ifThere === 'function') ctx.ifThere('cast', personPath(key)); },
        touchNote: id => { if (typeof ctx.ifThere === 'function') ctx.ifThere('cast', `/notes/${String(id).replace(/~/g, '~0').replace(/\//g, '~1')}`); },
        note: entry => addNote(ctx, cast, at, entry),
        packName: pack => packNames[pack] || pack,
    };
}

export function only(ctx, what) {
    if (ctx.cause !== 'system') ctx.fail('REFUSED', `${what} is decided by Story Director itself, before a reply.`);
}
