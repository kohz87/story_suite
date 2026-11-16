// Which of the chat's messages the story still stands on: the message gate from the Story Suite adapter and the active chat it yields.
import { readContext } from './source.js';

// (timeline participant) Which of the chat's messages the story still stands on. After a restore Story Block fades the replies of the dead
// timeline and hides them with SillyTavern's own flag (`is_system`), which every reader below already skips, so a prompt needs no filtering of
// its own. The gate is the second look, for a message the host could not hide and for the moment before it has: `gate` = { refresh():
// Promise<boolean[] | null>, settled(): Promise<boolean> } from the Story Suite adapter, or none (the chat as it is, byte for byte).
// `refresh` answers Story Block's one active-history filter (`sdk.timeline.history`), one entry per message of the chat as it stood when it
// was asked; the faded messages are remembered by identity, so a delete or a swipe after it cannot move the mark onto another message. A faded
// message reads as a system message: skipped by every walk below, and its index is kept.
let gate = null;
let faded = null;   // WeakSet of the chat's message objects the story no longer stands on, as of the last refresh; null: none known
export function useMessageGate(next) {
    gate = next && typeof next.refresh === 'function' ? next : null;
    if (!gate) faded = null;
}
/** Asks the host which messages are faded now. Awaited before any prompt is built from the chat (a scan, a refresh, an import, a backfill). */
export async function refreshMessageGate() {
    if (!gate) return;
    const chat = [...(readContext().chat || [])];
    let flags = null;
    try { flags = await gate.refresh(); } catch { flags = null; }
    const list = Array.isArray(flags) && flags.length === chat.length ? chat.filter((message, at) => flags[at] === false && message && typeof message === 'object') : [];
    faded = list.length ? new WeakSet(list) : null;
}
/**
 * Whether the host's head-selection barrier is down and Delta stands on the checkpoint of the selected head (Story Block's barrier;
 * participants.md). Awaited before a scan, a targeted pass, a branch reconcile or a generation reads or writes the dossiers. true without a gate.
 * `{ wait: false }`: one look at the barrier, no waiting.
 */
export async function messageGateSettled(options = undefined) {
    if (typeof gate?.settled !== 'function') return true;
    try { return (await gate.settled(options)) !== false; } catch { return true; }
}
/** The chat as the story stands on it: the faded messages read as system messages; the same array when none is faded. */
export function activeChat(chat = readContext().chat || []) {
    if (!faded) return chat;
    return chat.map(message => (message && faded.has(message) ? { ...message, is_system: true } : message));
}
