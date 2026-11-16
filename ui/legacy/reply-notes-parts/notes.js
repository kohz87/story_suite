// The notes under a reply: drawing, updating and removing them, and the Re-read they offer (createReplyNotes).

import { extractBlock } from '../../../../../core/capture.js';
import { isCarrier, readRecord, swipeOf } from '../../../../../core/persist.js';
import { STRINGS, fill } from '../../../../../core/strings.js';
import { refusedFrom, warnedFrom } from './problems.js';

const N = STRINGS.notes;
const NOTE = 'story-suite-reply-note';
/** How many of the last drawn messages a redraw after a rebuild goes over. */
export const RECENT_MESSAGES = 30;

/** The first carrier's index (the greeting), or -1. */
const firstCarrier = chat => (Array.isArray(chat) ? chat.findIndex(isCarrier) : -1);

/**
 * createReplyNotes({ ctx, doc?, extractorOn?() → bool, extractorFailed?(index, swipe) → bool, reread?(index) → Promise<{ ok, problems?, message? }>,
 * turn? (for problems()), events? (the runtime's: 'turn', 'head'), messageElement?(index), onChanged?(index) })
 * Long chats: a rebuild (`head`) redraws the notes of the last RECENT_MESSAGES drawn messages only; a chat
 * opened, a delete or more messages loaded go over every drawn message. Each pass finds the messages with one
 * query (not one document query per message).
 * → { refresh(index), refreshAll({ recent }), refusedAt(index), warnedAt(index), noteKind(index), markEdited(index), onTurn(turn),
 *     reread(index), forget(), destroy() }
 */
export function createReplyNotes({
    ctx, doc = globalThis.document, extractorOn = () => false, extractorFailed = () => false, reread = null, turn = null, events = null,
    messageElement = null, onChanged = () => {}, onForget = () => {},
} = {}) {
    const chat = () => (Array.isArray(ctx?.chat) ? ctx.chat : []);
    const elementOf = messageElement ?? (index => doc.querySelector(`.mes[mesid="${index}"]`));
    const canReread = typeof reread === 'function';
    const edited = new Set();      // `${index}|${swipe}` edited since the chat was opened
    const refused = new Map();     // `${index}|${swipe}` → [{ line, reason }]
    const warned = new Map();      // same key → [{ line, reason }]: applied lines the code warned about
    const busy = new Map();        // index → true while a Re-read runs
    const failed = new Map();      // `${index}|${swipe}` → message of the last failed Re-read
    let era = 0;                   // forget() starts a new one: what a Re-read answers after it is for indexes that no longer hold
    const keyOf = index => `${index}|${swipeOf(chat()[index])}`;

    /** 'missing' | 'edited' | null: which note reply `index` gets now. */
    function noteKind(index) {
        const message = chat()[index];
        if (!isCarrier(message) || message.is_system || index === firstCarrier(chat())) return null;
        if (!readRecord(message)) return null;
        let extractor = false;
        try { extractor = extractorOn() === true; } catch { extractor = false; }
        // C2-ext: the extractor's call failed (an error, a time-out) on this reply: nobody read it.
        if (extractor) {
            try { extractor = extractorFailed(index, swipeOf(message)) !== true; } catch { /* still on */ }
        }
        if (!extractor && extractBlock(String(message.mes ?? '')) === null) return 'missing';
        if (canReread && edited.has(keyOf(index))) return 'edited';
        return null;
    }

    function build(kind) {
        const note = doc.createElement('div');
        note.className = NOTE;
        note.setAttribute('role', 'note');
        const icon = doc.createElement('i');
        icon.className = `fa-solid ${kind === 'missing' ? 'fa-triangle-exclamation' : 'fa-pen'}`;
        icon.setAttribute('aria-hidden', 'true');
        const text = doc.createElement('span');
        text.className = `${NOTE}-text`;
        note.append(icon, text);
        if (canReread) {
            const button = doc.createElement('button');
            button.type = 'button';
            button.setAttribute('type', 'button');
            button.className = `${NOTE}-reread`;
            button.setAttribute('title', N.rereadTitle);
            button.addEventListener('click', event => {
                event?.stopPropagation?.();
                const index = Number(note.getAttribute('data-ss-index'));
                if (Number.isInteger(index)) runReread(index);
            });
            note.appendChild(button);
        }
        const error = doc.createElement('span');
        error.className = `${NOTE}-error`;
        error.setAttribute('role', 'alert');
        error.hidden = true;
        note.appendChild(error);
        return note;
    }

    function place(message, note) {
        const text = message.querySelector('.mes_text');
        const parent = text?.parentNode ?? message.querySelector('.mes_block') ?? message;
        const after = text ? text.nextElementSibling : null;
        if (note.parentNode === parent && (text ? note === after : true)) return;
        parent.insertBefore(note, after);
    }

    /** Draws, updates or removes the note under reply `index` (when SillyTavern has drawn it). */
    function refresh(index, element = null) {
        const message = element ?? elementOf(index);
        if (!message) return null;
        let note = message.querySelector(`.${NOTE}`);
        const kind = noteKind(index);
        if (!kind) {
            note?.remove();
            return null;
        }
        if (!note || note.getAttribute('data-kind') !== kind) {
            note?.remove();
            note = build(kind);
        }
        note.setAttribute('data-kind', kind);
        note.setAttribute('data-ss-index', String(index));
        note.querySelector(`.${NOTE}-text`).textContent = kind === 'missing' ? N.missing : N.edited;
        note.setAttribute('title', kind === 'missing' ? N.missingTitle : '');
        const button = note.querySelector(`.${NOTE}-reread`);
        if (button) {
            const running = busy.has(index);
            button.textContent = running ? N.rereading : N.reread;
            button.disabled = running;
            if (running) button.setAttribute('aria-busy', 'true');
            else button.removeAttribute('aria-busy');
        }
        const error = note.querySelector(`.${NOTE}-error`);
        const why = failed.get(keyOf(index));
        error.textContent = why ? fill(N.rereadFailed, { message: why }) : '';
        error.hidden = !why;
        place(message, note);
        return note;
    }

    /** Every reply SillyTavern has drawn. */
    function refreshAll({ recent = false } = {}) {
        const drawn = Array.from(doc.querySelectorAll('.mes[mesid]'));
        for (const message of recent ? drawn.slice(Math.max(0, drawn.length - RECENT_MESSAGES)) : drawn) {
            const index = Number(message.getAttribute('mesid'));
            if (Number.isInteger(index)) refresh(index, messageElement ? null : message);
        }
    }

    async function runReread(index) {
        if (!canReread || busy.has(index)) return null;
        const key = keyOf(index);
        const began = era;
        busy.set(index, true);
        failed.delete(key);
        refresh(index);
        let result;
        try {
            result = await reread(index);
        } catch (error) {
            result = { ok: false, message: error?.message ?? String(error) };
        }
        if (began !== era) return result;   // the chat changed or messages moved meanwhile: the answer is not for these indexes
        busy.delete(index);
        if (result?.ok) {
            edited.delete(key);
            if (Array.isArray(result.problems)) {
                const items = result.problems.map(item => ({ index, ...item }));
                refused.set(key, refusedFrom(items, index));
                warned.set(key, warnedFrom(items, index));
            }
        } else {
            failed.set(key, result?.message ?? N.unknownError);
        }
        refresh(index);
        try { onChanged(index); } catch { /* the card redraw is a courtesy */ }
        return result;
    }

    /** A turn the runtime finished (its 'turn' event): the reply's refused lines, then its note. */
    function onTurn(done) {
        const index = Number(done?.index);
        if (!Number.isInteger(index)) return;
        const key = keyOf(index);
        const problems = Array.isArray(done.problems) ? done.problems : (turn?.problems?.() ?? []);
        const lines = refusedFrom(problems, index);
        // Late lines (the extractor's) add to what the reply already had; anything else starts afresh.
        refused.set(key, done.type === 'late' ? [...(refused.get(key) ?? []), ...lines] : lines);
        const notes = warnedFrom(problems, index);
        warned.set(key, done.type === 'late' ? [...(warned.get(key) ?? []), ...notes] : notes);
        failed.delete(key);
        refresh(index);
    }

    /** The refused change lines of reply `index`, on its shown swipe: [{ line, reason }]. */
    function refusedAt(index) {
        return (refused.get(keyOf(index)) ?? []).map(item => ({ ...item }));
    }

    /** The applied lines of reply `index` the code warned about, on its shown swipe: [{ line, reason }]. */
    function warnedAt(index) {
        return (warned.get(keyOf(index)) ?? []).map(item => ({ ...item }));
    }

    function markEdited(index) {
        const at = Number(index);
        if (!Number.isInteger(at) || !readRecord(chat()[at])) return;
        edited.add(keyOf(at));
        refresh(at);
    }

    /** Message indexes moved (a delete) or the chat changed: nothing kept by index still holds. */
    function forget() {
        era += 1;
        edited.clear();
        refused.clear();
        warned.clear();
        failed.clear();
        busy.clear();
        try { onForget(); } catch { /* the card's own memory */ }
    }

    // ---- following SillyTavern and the runtime ----------------------------------------------
    const offs = [];
    const indexOf = value => Number(typeof value === 'object' && value !== null ? value.messageId ?? value.index : value);
    const source = ctx?.eventSource;
    const types = ctx?.eventTypes ?? ctx?.event_types ?? {};
    if (typeof source?.on === 'function') {
        const wire = [
            [types.CHARACTER_MESSAGE_RENDERED, value => refresh(indexOf(value))],
            [types.MESSAGE_SWIPED, value => refresh(indexOf(value))],
            [types.MESSAGE_EDITED, value => markEdited(indexOf(value))],
            [types.MESSAGE_UPDATED, value => refresh(indexOf(value))],
            [types.MESSAGE_DELETED, () => { forget(); refreshAll(); }],
            [types.CHAT_CHANGED, () => { forget(); refreshAll(); }],
            [types.MORE_MESSAGES_LOADED, () => refreshAll()],
        ].filter(([type]) => type);
        for (const [type, fn] of wire) source.on(type, fn);
        offs.push(() => {
            for (const [type, fn] of wire) (source.removeListener ?? source.off)?.call(source, type, fn);
        });
    }
    if (typeof events?.on === 'function') {
        for (const off of [events.on('turn', onTurn), events.on('head', () => refreshAll({ recent: true }))]) if (typeof off === 'function') offs.push(off);
    }

    return {
        refresh,
        refreshAll,
        refusedAt,
        warnedAt,
        noteKind,
        markEdited,
        onTurn,
        reread: runReread,
        canReread: () => canReread,
        forget,
        destroy() {
            offs.splice(0).forEach(off => off());
            forget();
            for (const note of doc.querySelectorAll(`.${NOTE}`)) note.remove();
        },
    };
}
