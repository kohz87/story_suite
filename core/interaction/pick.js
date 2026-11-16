// The payload a send carries and its opening: the staged session (with its Send copy), else the Send copy, else (regenerate) the last payload the reader's message is linked to.
// Shared by the core's hooks and by a module that needs to know whether a send carries an interaction (the RPG's story-check line).

import { readSend } from './send.js';
import { interactionPayload } from './session.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const openingOf = (session, copy) => (plain(copy?.opening) ? copy.opening : session && !session.carriedKey && session.offset === 0 && plain(session.opening) ? session.opening : null);

/**
 * → `{ payload, opening, session }`, `{ wait: session }` (staged but not sent), or `{ session }` (nothing carried).
 * `auto`: the kind's staged steps go with the next message with no Send copy (`autoSend`), which the caller allows only while no waiting choice asks for the copy.
 */
export function pickPayload(box, messages, type, last, anchor, { auto = false, last: lastOk = true } = {}) {
    const session = plain(box.open) && box.open.anchor === anchor ? box.open : null, copy = readSend(box, messages);
    const staged = session?.steps?.length ? session : null;
    if (staged) {
        if (copy && copy.payload.steps.length === staged.steps.length && !staged.invalidated) return { payload: interactionPayload(staged), opening: openingOf(staged, copy), session: staged };
        if (auto && !copy && !staged.invalidated) return { payload: interactionPayload(staged), opening: openingOf(staged, null), session: staged };
        return { wait: staged };
    }
    if (copy) return { payload: structuredClone(copy.payload), opening: openingOf(null, copy), session };
    const lastOne = box.last;
    // (the reader's message is linked to the payload by its key, so a regenerate carries it even after an earlier reply was deleted and the anchor moved)
    if (type === 'regenerate' && lastOk && plain(lastOne) && last?.extra?.storySuiteInteractionLinks?.[lastOne.key]) {
        return { payload: structuredClone(lastOne), opening: plain(box.lastOpening) && box.lastOpening.payload.anchor === lastOne.anchor ? box.lastOpening : null, session };
    }
    return { session };
}
