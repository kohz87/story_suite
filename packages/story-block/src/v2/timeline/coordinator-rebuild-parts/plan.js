// The reading side of a rebuild: its read plan, the head reply's number, and the sentence a finished rebuild records.

import { fail, isObject } from '../util.js';
import { REBUILD_DEFAULT_REPLIES, REBUILD_READ_ALL, REBUILD_READ_LAST } from './constants.js';

/** The Problem code a successful rebuild records. */
export const REBUILD_PROBLEM_CODE = 'REBUILT';

/** The read plan of `rebuild(module, input)`: `{ ok: true, read, replies }` or INVALID. */
export function readPlan(input = {}) {
    if (input === undefined) input = {};
    if (!isObject(input)) return fail('INVALID', 'rebuild takes { read? }.');
    for (const key of Object.keys(input)) if (key !== 'read') return fail('INVALID', `rebuild does not take "${key}".`);
    const read = input.read ?? REBUILD_READ_LAST;
    if (read === REBUILD_READ_LAST) return { ok: true, read, replies: REBUILD_DEFAULT_REPLIES };
    if (read === REBUILD_READ_ALL) return { ok: true, read, replies: null };
    return fail('INVALID', `The rebuild reads "${REBUILD_READ_LAST}" or "${REBUILD_READ_ALL}", not ${JSON.stringify(read)}.`);
}

/**
 * The reader-facing number of the head reply: the count of story replies through the boundary, or the message
 * position when the chat is not available. → a whole number, or null when the boundary has no position.
 */
export function replyNumberAt(boundary, messages = []) {
    const at = Number.isInteger(boundary?.index) ? boundary.index : -1;
    if (at < 0) return null;
    if (Array.isArray(messages) && messages.length > at) {
        let replies = 0;
        for (let index = 0; index <= at; index += 1) if (messages[index] && !messages[index].is_user) replies += 1;
        if (replies > 0) return replies;
    }
    return at + 1;
}

/** The exact Problem sentence a successful rebuild records. */
export const rebuildMessage = reply => `dossiers rebuilt from the chat at reply ${reply}`;
