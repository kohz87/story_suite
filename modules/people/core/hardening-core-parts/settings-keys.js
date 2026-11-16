/* Settings key lookup: every key in the data/tombstone/recovery maps, the keys one owner holds, and the destination key of an owner rename. */
import { buildQualifiedChatKey, parseQualifiedChatKey } from '../identity.js';

export function allSettingsKeys(settings = {}) {
    const maps = ['dataFiles', 'sidecarTombstones', 'recoveryFiles'];
    const keys = new Set();
    for (const mapName of maps) for (const key of Object.keys(settings?.[mapName] || {})) keys.add(key);
    return [...keys];
}

export function qualifiedKeysForOwner(settings = {}, kind = 'chat', ownerId = '') {
    const owner = String(ownerId || '').trim();
    return allSettingsKeys(settings).filter(key => {
        const parsed = parseQualifiedChatKey(key);
        return parsed?.kind === kind && parsed.ownerId === owner;
    });
}

export function destinationKeyForOwnerRename(oldKey, newOwnerId) {
    const parsed = parseQualifiedChatKey(oldKey);
    if (!parsed || parsed.kind !== 'chat') return '';
    return buildQualifiedChatKey('chat', newOwnerId, parsed.chatId);
}
