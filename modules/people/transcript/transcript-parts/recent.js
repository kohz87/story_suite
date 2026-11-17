// The recent windows of the chat: the last lines, the reply ids they hold, every active reply id and the user lines.
import { activeChat } from './gate.js';
import { windowChat } from './hidden.js';
import { cleanMessage } from './shared-clean.js';
import { readContext, readScanDepth } from './source.js';

/** `hidden`: a Refresh's window, which also reads the messages SillyTavern hid (hidden.js). */
export function recentTranscript(limit = null, { messageIds = false, hidden = false } = {}) {
    const chat = windowChat(hidden);
    const count = Math.max(2, Math.min(30, Number(limit ?? readScanDepth()) || 6));
    const lines = [];
    // Walk backward and stop as soon as the requested meaningful window is full.
    // Long chats no longer pay to clean every historical message on each scan/injection.
    for (let i = chat.length - 1; i >= 0 && lines.length < count; i -= 1) {
        if (!chat[i] || chat[i].is_system) continue;
        const line = cleanMessage(chat[i]);
        if (line) lines.push(messageIds ? `[m${i}] ${line}` : line);
    }
    return lines.reverse().join('\n');
}

/** The ids of the replies (not the user's messages) that `recentTranscript(limit)` holds, oldest first: what a manual or full-window scan reads. */
export function recentReplyIds(limit = null) {
    const chat = activeChat(readContext().chat || []);
    const count = Math.max(2, Math.min(30, Number(limit ?? readScanDepth()) || 6));
    const ids = [];
    let lines = 0;
    for (let i = chat.length - 1; i >= 0 && lines < count; i -= 1) {
        if (!chat[i] || chat[i].is_system) continue;
        if (!cleanMessage(chat[i])) continue;
        lines += 1;
        if (!chat[i].is_user) ids.push(i);
    }
    return ids.reverse();
}

/** The ids of every reply the story stands on (not the user's, not system or faded), oldest first. */
export function activeReplyIds() {
    const chat = activeChat(readContext().chat || []);
    const ids = [];
    for (let i = 0; i < chat.length; i += 1) if (chat[i] && !chat[i].is_system && !chat[i].is_user) ids.push(i);
    return ids;
}

export function recentUserDevelopmentContext(limit = null, { messageIds = true, hidden = false } = {}) {
    const chat = windowChat(hidden);
    const count = Math.max(2, Math.min(30, Number(limit ?? readScanDepth()) || 6));
    const selected = [];
    let meaningful = 0;
    for (let i = chat.length - 1; i >= 0 && meaningful < count; i -= 1) {
        const message = chat[i];
        if (!message || message.is_system) continue;
        const line = cleanMessage(message);
        if (!line) continue;
        meaningful += 1;
        if (message.is_user) selected.push(messageIds ? `[m${i}] ${line}` : line);
    }
    return selected.reverse().join('\n');
}
