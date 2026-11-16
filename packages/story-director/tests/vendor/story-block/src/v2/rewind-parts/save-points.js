// Save points: named branches of the chat kept in its metadata, listed, made, returned to and forgotten (createSavePoints).

import { newId } from '../sdk.js';
import { oneLine } from '../../text.js';
import { CORE_FEATURE } from '../features.js';
import { stCreateBranch, stReopen } from './st-branch.js';
import { fail, limited } from './shared-limits.js';

// ---- save points (MODULES §F93) -------------------------------------------------------------------
//
// A save point is a SillyTavern branch of the chat at the current reply, made with the same machinery as
// rewind (but left closed: the reader stays where they are), and a named entry in the chat's own
// metadata: `chatMetadata.storySuite.savePoints[id] = { id, name, index, branch, at, rev }`. Return here
// opens that branch (the story there is the story as it was: its records came along with the messages).
//
// Why chat metadata and not story state: a save point is about the reader's chat files, not about the
// story. Story state is replayed per line of history, so a save point kept there would be taken back by
// a swipe, a deleted reply or a rewind (the very moments a reader wants to go back from), would cost a
// receipt and a rev of its own, and would be part of the branch it names (made at the moment before it).
// Metadata belongs to the chat file: it stays put through swipes and deletes, and nothing in the story
// (the prompt, the replay, the rev) changes because a save point was made. Branches made from the chat
// carry a copy of its list as it was then (SillyTavern copies the metadata into the branch file).

export const SAVEPOINTS_FEATURE = CORE_FEATURE.savepoints;
export const SAVEPOINT_LIMITS = Object.freeze({ name: 60, count: 50 });

const flat = (text, max) => oneLine(text, max).trimEnd();
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const ID = /^sp_[a-z0-9]{8}$/;

/** A stored entry as the list shows it, or null when it is not one Story Block wrote. */
function readPoint(id, value) {
    if (!ID.test(id) || !isRecord(value) || typeof value.branch !== 'string' || !value.branch) return null;
    return {
        id,
        name: flat(value.name, SAVEPOINT_LIMITS.name) || value.branch,
        index: Number.isInteger(value.index) && value.index >= 0 ? value.index : null,
        branch: value.branch,
        at: typeof value.at === 'string' ? value.at : '',
        rev: Number.isInteger(value.rev) ? value.rev : null,
    };
}

/**
 * createSavePoints({ ctx, store, live?, createBranch?, open?, now?, id? }) → {
 *   list() → [{ id, name, index, branch, at, rev }], newest first (the chat open now);
 *   save({ name? }) → Promise<{ ok: true, point } | { ok: false, code, message }>;
 *   returnTo(id) → Promise<{ ok: true, branch, here? } | { ok: false, code, message }>;
 *   forget(id) → Promise<{ ok: true } | { ok: false, code, message }> (the branch itself is kept);
 *   chatId() → the chat open now }.
 * `live()`: SillyTavern's live context (its chatMetadata and saveMetadata follow the chat open now);
 * `createBranch(index)`: stCreateBranch; `open(name)`: stReopen; `now()`: the time a save point is
 * stamped with (only shown to the reader; nothing is ordered by it).
 */
export function createSavePoints({
    ctx, store, live = () => globalThis.SillyTavern?.getContext?.() ?? ctx,
    createBranch = stCreateBranch(ctx, { live }), open = stReopen(ctx, { live }), now = () => Date.now(), id = () => newId('sp'),
}) {
    let running = false;
    const context = () => {
        try { return live() ?? ctx; } catch { return ctx; }
    };
    const chatId = () => {
        const c = context();
        return typeof c?.getCurrentChatId === 'function' ? c.getCurrentChatId() : c?.chatId;
    };
    // The chat's entries: chatMetadata.storySuite.savePoints, made on the way when `make`.
    function table({ make = false } = {}) {
        const c = context();
        if (!isRecord(c?.chatMetadata)) {
            if (!make || !c) return null;
            c.chatMetadata = {};
        }
        const meta = c.chatMetadata;
        if (!isRecord(meta.storySuite)) {
            if (!make) return null;
            meta.storySuite = {};
        }
        if (!isRecord(meta.storySuite.savePoints)) {
            if (!make) return null;
            meta.storySuite.savePoints = {};
        }
        return meta.storySuite.savePoints;
    }
    async function persist() {
        const c = context();
        if (typeof c?.saveMetadata === 'function') return c.saveMetadata();
        if (typeof c?.saveMetadataDebounced === 'function') return c.saveMetadataDebounced();
        return store?.saveSoon?.();
    }
    function list() {
        const entries = Object.entries(table() ?? {}).map(([key, value]) => readPoint(key, value)).filter(Boolean);
        // Newest first by the reply they were made at, then by the order they were added (key order).
        return entries.map((point, at) => ({ point, at })).sort((a, b) => (b.point.index ?? -1) - (a.point.index ?? -1) || b.at - a.at).map(item => item.point);
    }

    async function save({ name = '' } = {}) {
        if (running) return fail('STALE', 'A save point is already being made.');
        const chat = context()?.chat ?? ctx?.chat ?? [];
        let index;
        try { index = store.headIndex(); } catch { index = -1; }
        if (!Number.isInteger(index) || index < 0 || index >= chat.length || chat[index]?.is_user) {
            return fail('NOT_FOUND', 'There is no reply to keep yet: a save point is made at the latest reply that keeps the story.');
        }
        const points = list();
        if (points.length >= SAVEPOINT_LIMITS.count) {
            return fail('LIMITED', `This chat has ${SAVEPOINT_LIMITS.count} save points, the most it keeps; forget one first.`);
        }
        const label = flat(name, SAVEPOINT_LIMITS.name) || `Save point ${points.length + 1}`;
        running = true;
        try {
            const from = chatId();
            const rev = store.head?.()?.meta?.rev;
            try { await store.flush?.(); } catch { /* the store tries again; the branch takes the chat as it is in memory */ }
            let branch;
            try { branch = await limited(() => createBranch(index), 'make the branch'); } catch (error) {
                return fail('FAILED', `The chat could not be branched: ${error?.message ?? error}`);
            }
            if (typeof branch !== 'string' || !branch) return fail('FAILED', 'SillyTavern did not create the branch.');
            if (chatId() !== from) {
                return fail('FAILED', `Another chat was opened while the save point was made; the branch "${branch}" was kept in SillyTavern but is not listed.`);
            }
            const key = id();
            const point = { id: key, name: label, index, branch, at: new Date(now()).toISOString(), rev: Number.isInteger(rev) ? rev : null };
            table({ make: true })[key] = { name: point.name, index, branch, at: point.at, rev: point.rev };
            try { await persist(); } catch (error) {
                return { ok: true, point, warning: `The save point is listed, but the chat could not be saved yet: ${error?.message ?? error}` };
            }
            return { ok: true, point };
        } finally {
            running = false;
        }
    }

    async function returnTo(key) {
        const point = list().find(item => item.id === key);
        if (!point) return fail('NOT_FOUND', 'That save point is not in this chat\'s list.');
        if (chatId() === point.branch) return { ok: true, branch: point.branch, here: true };
        if (running) return fail('STALE', 'A save point is being made; try again in a moment.');
        running = true;
        try {
            try { await store?.flush?.(); } catch { /* kept unsaved; the store tries again */ }
            try { await limited(() => open(point.branch), 'open the branch'); } catch (error) {
                return fail('FAILED', `The branch "${point.branch}" could not be opened (it may have been renamed or deleted in SillyTavern): ${error?.message ?? error}`);
            }
            return { ok: true, branch: point.branch };
        } finally {
            running = false;
        }
    }

    async function forget(key) {
        const entries = table();
        if (!entries || !Object.hasOwn(entries, key)) return fail('NOT_FOUND', 'That save point is not in this chat\'s list.');
        delete entries[key];
        try { await persist(); } catch (error) {
            return { ok: true, warning: `Taken off the list, but the chat could not be saved yet: ${error?.message ?? error}` };
        }
        return { ok: true };
    }

    return { list, save, returnTo, forget, chatId };
}
