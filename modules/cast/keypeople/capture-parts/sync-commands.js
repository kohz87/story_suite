// Story Director v2, part **keypeople**: the system's commands that sync removals from NPC State Delta and tell their card lines.

import { REASONS, findPin, isRecord } from '../domain.js';
import { calendarFrom } from '../time.js';
import { addNote } from './notes.js';
import { removePin, whyText } from './removal.js';
import { nowOf, query } from './shared-ctx.js';
import { gonePath } from './shared-text.js';

const SYNC_REASONS = REASONS.filter(reason => reason !== 'unpinned');

/**
 * `keypeople.sync { who?: [{ name, reason }], known?: [name | { name, id? }] }` (cause `system`, from the hook before a reply): what NPC State
 * Delta says about the pinned. `who`: archived or dead there, so they leave the list with that reason. `known`: pinned people
 * it knows now (noted on their pin, so a later disappearance reads as archived). Someone not pinned any more is skipped.
 * Refused from anywhere else.
 */
export function sync(ctx, payload = {}) {
    if (ctx.cause !== 'system') return ctx.fail('REFUSED', 'Who leaves the key list because NPC State Delta archived or lost them is decided by Story Director itself.');
    const { who = [], known = [] } = isRecord(payload) ? payload : {};
    if (!isRecord(payload) || Object.keys(payload).some(field => !['who', 'known'].includes(field)) || !Array.isArray(who) || !Array.isArray(known) || who.length > 24 || known.length > 24) {
        return ctx.fail('INVALID', 'keypeople.sync takes { who?: [{ name, reason }], known?: [name | { name, id? }] }.');
    }
    const kp = ctx.draft('keypeople');
    const calendar = calendarFrom(query(ctx));
    const now = nowOf(ctx);
    const told = [];
    const keys = [];
    for (const entry of who) {
        if (!isRecord(entry) || typeof entry.name !== 'string' || !SYNC_REASONS.includes(entry.reason)) return ctx.fail('INVALID', `keypeople.sync: each of who is { name, reason: ${SYNC_REASONS.join(' | ')} }.`);
        const found = findPin(kp, entry.name);
        if (!found) continue;
        told.push(removePin(ctx, kp, found.key, found.pin, entry.reason, calendar, now, { defer: true }));
        keys.push(found.key);
    }
    for (const entry of known) {
        const name = typeof entry === 'string' ? entry : entry?.name;
        const id = isRecord(entry) ? entry.id : undefined;
        if (typeof name !== 'string' || (id !== undefined && !(typeof id === 'string' && /^np_[0-9a-z]{8}$/.test(id)))) return ctx.fail('INVALID', 'keypeople.sync: known is a list of names, or { name, id? }.');
        const found = findPin(kp, name);
        if (!found || (found.pin.nsd === true && (id === undefined || found.pin.npc === id))) continue;
        // Inside a pin the reply that made it may be gone: passed over then (SPEC §2.2 rule d).
        ctx.ifThere('keypeople', `/pins/${found.key}`);
        found.pin.nsd = true;
        if (id !== undefined) found.pin.npc = id;
    }
    return { summary: told.join(' '), narrate: false, data: { removed: keys } };
}

/**
 * `keypeople.tell { who: [key] }` (cause `system`, from the hook after a reply's story lines): the card line of removals that
 * `keypeople.sync` made on the reply before (their `gone` record is `owed`). It is written on the reply being written when they were decided.
 * Someone not owed any more (told already, or taken off the list again) is skipped; nothing is said for them twice.
 */
export function tell(ctx, payload = {}) {
    if (ctx.cause !== 'system') return ctx.fail('REFUSED', 'The card line of a removal NPC State Delta made is written by Story Director itself.');
    if (!isRecord(payload) || Object.keys(payload).some(field => field !== 'who') || !Array.isArray(payload.who) || payload.who.length > 24 || payload.who.some(key => typeof key !== 'string')) {
        return ctx.fail('INVALID', 'keypeople.tell takes { who: [key] }.');
    }
    const kp = ctx.draft('keypeople');
    const calendar = calendarFrom(query(ctx));
    const told = [];
    const keys = [];
    for (const key of payload.who) {
        const entry = Object.hasOwn(kp.gone, key) ? kp.gone[key] : null;
        if (!isRecord(entry) || entry.owed !== true) continue;
        // The record may be gone when the reply that made it was deleted: passed over then (SPEC §2.2 rule d).
        ctx.ifThere('keypeople', gonePath(key));
        delete entry.owed;
        const why = whyText(entry.reason, calendar, entry.on);
        addNote(ctx, kp, { kind: 'gone', name: entry.name, head: `${entry.name} is no longer a key person`, rest: `(${why}).`, key, goneRev: entry.rev });
        told.push(`${entry.name} is no longer a key person (${why}).`);
        keys.push(key);
    }
    return { summary: told.length ? `Key person: ${told.join(' ')}` : '', narrate: false, data: { told: keys } };
}
