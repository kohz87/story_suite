/* NPC State Delta chat identity: qualified chat keys, owner scope and identity from the host context. Public face: re-exports its parts. */
export { encodeChatKeyPart, decodeChatKeyPart } from './identity-parts/key-codec.js';
export { buildQualifiedChatKey, parseQualifiedChatKey, isQualifiedChatKey } from './identity-parts/qualified-key.js';
export { chatOwnerScope, sameChatOwnerScope } from './identity-parts/owner-scope.js';
export { getCharacterOwnerId, getChatIdentityFromContext } from './identity-parts/context-identity.js';
