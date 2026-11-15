// Builds the view modules read, and tells whether a feature is on.

import { headReply } from '../../commands.js';
import { chatMarked } from '../../persist/records.js';
import { runQuery } from './run.js';

/**
 * What modules read (§6): { state (frozen head), query(name, args), settings(id), feature(id), chat:
 * { length, lastUser, readers (how many messages are the reader's) } }. `chat`: SillyTavern's chat array (or nothing). `feature(id)`: whether the
 * reader has that feature on (MODULES §F100); false for an id no module declares. `state` and `reply`
 * (optional): another state than the head and the reply it stands for (`tools.reply`), for a Re-read's
 * afterCapture hook, which reads the reply's state after its new story lines (turn.js).
 */
export function makeView({ store, registry, settings, chat = [], active = null, state = store.head(), reply = headReply(store), pendingProofs = null, boardStop = null }) {
    const messages = Array.isArray(chat) ? chat : [];
    // (`active`: the timeline's reader of earlier messages, so a faded message of the reader's is not the last one a module sees)
    const seen = active ? active.messages(messages) : messages;
    const lastUser = [...seen].reverse().find(message => message?.is_user);
    return Object.freeze({
        state,
        // How the board fight this reply carries ended (won / fled / lost / open), or null: set only while a reply's prompt is built.
        boardStop,
        query: (name, args) => runQuery(registry, state, name, args, { receipts: () => store.receipts?.() ?? [], reply, pendingProofs }),
        settings,
        feature: id => featureOn(registry, id),
        // Whether the chat is under rule mark `name` (persist/records.js chatMarked): what a static prompt text that follows a rule asks.
        rule: name => chatMarked(messages, name),
        chat: Object.freeze({ length: messages.length, lastUser: String(lastUser?.mes ?? ''), readers: seen.filter(message => message?.is_user).length }),
        // The state before the reply this view stands for (the one its lines start from), or null: asked by a step that compares the reply with it (the RPG's fight XP).
        before: () => { try { return Number.isInteger(reply?.index) ? store.before?.(reply.index) ?? null : null; } catch { return null; } },
    });
}

/** Whether feature `id` is on (registry.featureOn); false for an unknown id or a registry without features. */
export const featureOn = (registry, id) => typeof registry?.featureOn === 'function' && registry.featureOn(id) === true;
