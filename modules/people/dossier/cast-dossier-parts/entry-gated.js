// A pack entry's spec-form secrets ({ id, gate, text }), cleaned for the dossier; added only with the world-events switch on.

import { SECRETS_MAX } from './limits-lists.js';
import { clip, isObject } from './shared-text.js';

/**
 * The pack's spec-form secrets ({ id, gate, text, title? }), as the dossier would keep them: [{ packId, gate, text, title?, from: 'pack' }], at most eight.
 * Kept apart from `castSecrets` and added to a dossier only with the world-events switch on (applyCastEntry's `gated` option).
 */
export function castGatedSecrets(raw) {
    const out = [];
    for (const item of Array.isArray(raw) ? raw : []) {
        if (!isObject(item) || out.length >= SECRETS_MAX) continue;
        const text = clip(item.text, 300);
        const gate = clip(item.gate, 240);
        const packId = clip(item.id, 80);
        if (!text || !gate || !packId || out.some(note => note.packId === packId)) continue;
        const title = clip(item.title, 60);
        out.push({ packId, gate, text, ...(title ? { title } : {}), from: 'pack' });
    }
    return out;
}
