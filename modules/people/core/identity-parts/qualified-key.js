/* Qualified chat keys: building, parsing and recognising the chat/group key strings. */
import { decodeChatKeyPart, encodeChatKeyPart } from './key-codec.js';

export function buildQualifiedChatKey(kind, ownerId, chatId) {
    const prefix = kind === 'group' ? 'group' : (kind === 'chat' ? 'chat' : '');
    const owner = String(ownerId ?? '').trim();
    const chat = String(chatId ?? '').replace(/\.jsonl$/i, '').trim();
    if (!prefix || !owner || !chat) return '';
    return `${prefix}:${encodeChatKeyPart(owner)}:${encodeChatKeyPart(chat)}`;
}

export function parseQualifiedChatKey(key) {
    const match = String(key || '').match(/^(chat|group):([^:]+):(.+)$/);
    if (!match) return null;
    return {
        kind: match[1],
        ownerId: decodeChatKeyPart(match[2]),
        chatId: decodeChatKeyPart(match[3]),
        ownerToken: match[2],
        chatToken: match[3],
    };
}

export function isQualifiedChatKey(key) {
    return Boolean(parseQualifiedChatKey(key));
}
