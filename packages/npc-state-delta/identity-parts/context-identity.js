/* Chat identity from the host context: the character owner id and the current chat identity record. */
import { encodeChatKeyPart } from './key-codec.js';
import { buildQualifiedChatKey } from './qualified-key.js';

export function getCharacterOwnerId(ctx = {}) {
    const characterId = ctx.characterId;
    if (characterId === undefined || characterId === null) return '';
    const avatar = ctx.characters?.[characterId]?.avatar;
    return typeof avatar === 'string' ? avatar.trim() : '';
}

export function getChatIdentityFromContext(ctx = {}) {
    const raw = ctx.chatId || ctx.getCurrentChatId?.();
    const hasGroup = ctx.groupId !== undefined && ctx.groupId !== null && String(ctx.groupId) !== '';
    if (hasGroup) {
        const ownerId = String(ctx.groupId).trim();
        if (raw) return {
            key: buildQualifiedChatKey('group', ownerId, raw),
            kind: 'group', ownerId, id: String(raw), pending: false,
        };
        return { key: `group-pending:${encodeChatKeyPart(ownerId)}`, kind: 'group', ownerId, id: '', pending: true };
    }
    const ownerId = getCharacterOwnerId(ctx);
    if (raw && ownerId) return {
        key: buildQualifiedChatKey('chat', ownerId, raw),
        kind: 'chat', ownerId, id: String(raw), pending: false,
    };
    if (raw) return { key: `chat-pending:${encodeChatKeyPart(raw)}`, kind: 'character', ownerId: '', id: String(raw), pending: true };
    if (ownerId) return { key: `character:${encodeChatKeyPart(ownerId)}`, kind: 'character', ownerId, id: ownerId, pending: true };
    return { key: 'no-chat', kind: 'none', ownerId: '', id: '', pending: true };
}
