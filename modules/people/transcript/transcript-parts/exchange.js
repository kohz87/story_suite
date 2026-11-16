// The current exchange: the reply at (or before) a message id, the user message it answers, and the user line for development.
import { activeChat } from './gate.js';
import { cleanMessage } from './shared-clean.js';
import { readContext } from './source.js';

export function currentExchangeUserDevelopmentContext(messageId = null) {
    const ctx = readContext();
    const chat = activeChat(ctx.chat || []);
    let assistantId = Number.isInteger(messageId) ? messageId : chat.length - 1;
    while (assistantId >= 0 && (chat[assistantId]?.is_system || chat[assistantId]?.is_user)) assistantId -= 1;
    if (assistantId < 0) return '';
    for (let i = assistantId - 1; i >= 0; i -= 1) {
        if (chat[i]?.is_system) continue;
        if (chat[i]?.is_user) {
            const line = cleanMessage(chat[i]);
            return line ? `[m${i}] ${line}` : '';
        }
        break;
    }
    return '';
}

// The current exchange's messages: the assistant reply at (or before) `messageId` and the user
// message it answers, oldest first; null when there is no reply.
export function currentExchangeMessages(messageId = null) {
    const ctx = readContext();
    const chat = activeChat(ctx.chat || []);
    let assistantId = Number.isInteger(messageId) ? messageId : chat.length - 1;
    while (assistantId >= 0 && (chat[assistantId]?.is_system || chat[assistantId]?.is_user)) assistantId -= 1;
    if (assistantId < 0) return null;
    let userId = -1;
    for (let i = assistantId - 1; i >= 0; i -= 1) {
        if (chat[i]?.is_system) continue;
        if (chat[i]?.is_user) { userId = i; break; }
        // Do not walk across an older assistant turn looking for a distant user message.
        if (!chat[i]?.is_user) break;
    }
    return [userId >= 0 ? chat[userId] : null, chat[assistantId]].filter(Boolean);
}
