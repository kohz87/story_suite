// Positions of assistant messages in a chat: the latest one and how many sit at or after a message.

export function latestAssistantMessageId(chat = []) {
    for (let i = (Array.isArray(chat) ? chat.length : 0) - 1; i >= 0; i -= 1) {
        const message = chat[i];
        if (message && !message.is_user && !message.is_system && String(message.mes || '').trim()) return i;
    }
    return -1;
}

export function assistantMessageCountAtOrAfter(chat = [], messageId = 0) {
    const start = Math.max(0, Number.isInteger(messageId) ? messageId : 0);
    return (Array.isArray(chat) ? chat : []).slice(start).filter(message => (
        message && !message.is_user && !message.is_system && String(message.mes || '').trim()
    )).length;
}
