/* Chat owner scope: the owner prefix of a qualified chat key and whether two keys share it. */
import { parseQualifiedChatKey } from './qualified-key.js';

export function chatOwnerScope(key) {
    const parsed = parseQualifiedChatKey(key);
    return parsed ? `${parsed.kind}:${parsed.ownerToken}` : '';
}

export function sameChatOwnerScope(a, b) {
    const left = chatOwnerScope(a);
    return Boolean(left && left === chatOwnerScope(b));
}
