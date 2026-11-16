// The window of replies a lean scan skipped plus the current exchange, read oldest first with a catch-up marker.
import { storyProse } from '../../core/core.js';
import { activeChat } from './gate.js';
import { cleanMessage } from './shared-clean.js';
import { readContext } from './source.js';

/**
 * The replies a lean scan skipped plus the current exchange: every message after the last scanned one (`afterId`), or, with
 * no marker, the last `replies` assistant replies and the user message before the first. The window holds at most 30
 * messages (15 replies). When more replies are waiting than that, the OLDEST waiting ones are read first (catch-up): the
 * result says how far it read (`readThrough`, the newest reply read) and that the chat is still behind (`latest` false), and
 * the caller moves its marker to `readThrough` and scans again at once, so no reply is read twice or lost. `replies` is the
 * true count waiting. null when no earlier reply was skipped, so a scan with nothing skipped reads exactly the current
 * exchange as before.
 */
export function skippedExchangesWindow(messageId = null, { afterId: markerId = null, replies = 0, limit = null, fresh = false, skip = [] } = {}) {
    // A chat never scanned has no marker yet: it reads from the start. Any other missing marker (a fail-closed restore with no
    // divergence information) reads the latest reply only.
    const afterId = Number.isInteger(markerId) ? markerId : (fresh ? -1 : null);
    const chat = activeChat(readContext().chat || []);
    let assistantId = Number.isInteger(messageId) ? messageId : chat.length - 1;
    while (assistantId >= 0 && (chat[assistantId]?.is_system || chat[assistantId]?.is_user)) assistantId -= 1;
    if (assistantId < 0) return null;
    // No marker and not a new chat: the latest reply alone, as before; nothing already applied is re-read.
    if (!(Number.isInteger(afterId) && afterId < assistantId)) return null;
    const hasMarker = true;
    const wanted = Math.max(0, Math.round(Number(replies) || 0));
    const waiting = [];
    let assistants = 0;
    for (let i = assistantId; i >= 0; i -= 1) {
        const message = chat[i];
        if (!message || message.is_system) continue;
        if (hasMarker && i <= afterId) break;
        if (!message.is_user) {
            if (!hasMarker && assistants >= wanted) break;
            assistants += 1;
        }
        waiting.push(i);
    }
    if (assistants < 2) return null;
    waiting.reverse();   // oldest first
    // Replies a manual scan or a narration capture already read (`skip`, ids): not read again, with the user message each one answers. The reply
    // this scan is for is always read.
    const already = new Set((Array.isArray(skip) ? skip : [...(skip || [])]).filter(id => Number.isInteger(id) && id !== assistantId));
    if (already.size) {
        const drop = new Set();
        for (const [at, id] of waiting.entries()) {
            if (!already.has(id) || chat[id]?.is_user) continue;
            drop.add(id);
            const before = waiting[at - 1];
            if (before !== undefined && chat[before]?.is_user) drop.add(before);
        }
        for (let at = waiting.length - 1; at >= 0; at -= 1) if (drop.has(waiting[at])) waiting.splice(at, 1);
        assistants = waiting.filter(id => !chat[id].is_user).length;
        if (assistants < 2) return null;
    }
    // Oldest first, at most the cap; with no marker the same, counted back from the latest by `replies`.
    let kept = waiting.slice(0, WINDOW_MESSAGE_CAP);
    // A window ends on a reply; the user message after it belongs to the next one.
    while (kept.length > 1 && chat[kept[kept.length - 1]].is_user && kept.length < waiting.length) kept = kept.slice(0, -1);
    const lines = [];
    const users = [];
    const proseLines = [];
    for (const i of kept) {
        const line = cleanMessage(chat[i]);
        if (!line) continue;
        const body = storyProse(chat[i].mes || '');
        if (body) proseLines.push(`${chat[i].name || (chat[i].is_user ? readContext().name1 : readContext().name2) || ''}: ${body}`);
        lines.push(line);
        if (chat[i].is_user) users.push(`[m${i}] ${line}`);
    }
    if (!lines.length) return null;
    const readThrough = [...kept].reverse().find(i => !chat[i].is_user) ?? assistantId;
    const last = kept.lastIndexOf(readThrough);
    const lastExchange = kept.slice(Math.max(0, last - 1), last + 1).map(i => cleanMessage(chat[i])).filter(Boolean).join('\n');
    return {
        transcript: lines.join('\n'),
        userDevelopmentContext: users.join('\n'),
        // The window's story alone (no World State, Inner Chatter or blocks): who a relationship change involves.
        prose: proseLines.join('\n'),
        replies: assistants,
        // The replies this window holds, for the record of what was read.
        readIds: kept.filter(i => !chat[i].is_user),
        readThrough,
        latest: readThrough === assistantId,
        lastExchange,
    };
}
const WINDOW_MESSAGE_CAP = 30;
