/* Lifecycle key resolution: live candidate keys, the owned key of a chat and the deleted key judged from presence. */
import { buildQualifiedChatKey, parseQualifiedChatKey } from '../identity.js';

export function liveLifecycleCandidateKeys(settings = {}, cacheKeys = [], kind = 'chat', chatId = '') {
    const id = String(chatId ?? '').replace(/\.jsonl$/i, '').trim();
    if (!id) return [];
    const keys = new Set([
        ...Object.keys(settings?.dataFiles || {}),
        ...(cacheKeys ? [...cacheKeys] : []),
    ]);
    return [...keys].filter(key => {
        if (settings?.sidecarTombstones?.[key]) return false;
        const parsed = parseQualifiedChatKey(key);
        return parsed?.kind === kind && parsed.chatId === id;
    });
}

export function resolveOwnedLifecycleKey(candidates = [], kind = 'chat', chatId = '', ownerId = '', ownerWasProvided = false) {
    const id = String(chatId ?? '').replace(/\.jsonl$/i, '').trim();
    const owner = String(ownerId || '').trim();
    if (!id) return '';
    const unique = [...new Set(Array.isArray(candidates) ? candidates : [])];
    const direct = buildQualifiedChatKey(kind, owner, id);
    if (ownerWasProvided) return direct && unique.includes(direct) ? direct : '';
    if (direct && unique.includes(direct)) return direct;
    return unique.length === 1 ? unique[0] : '';
}

export function resolveDeletedLifecycleKeyFromPresence(candidates = [], presence = []) {
    const unique = [...new Set(Array.isArray(candidates) ? candidates : [])];
    if (!unique.length) return '';
    const byKey = new Map((Array.isArray(presence) ? presence : []).map(item => [String(item?.key || ''), item?.value]));
    if (unique.some(key => !byKey.has(key) || ![true, false].includes(byKey.get(key)))) return '';
    const absent = unique.filter(key => byKey.get(key) === false);
    const present = unique.filter(key => byKey.get(key) === true);
    return absent.length === 1 && present.length === unique.length - 1 ? absent[0] : '';
}
