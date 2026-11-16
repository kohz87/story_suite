// Story Director v2, names: the suggestion count clamp and the banned names parsed from the setting.

import { DEFAULT_SUGGESTIONS, MAX_SUGGESTIONS, MAX_BANNED } from './limits.js';
import { cleanName } from './text.js';
import { nameKey } from './keys.js';

/** A list count clamped to 0..MAX_SUGGESTIONS; a value that is not a number takes DEFAULT_SUGGESTIONS. */
export function clampCount(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return DEFAULT_SUGGESTIONS;
    return Math.min(MAX_SUGGESTIONS, Math.max(0, n));
}

/**
 * The banned names from the setting's text: one name per line or per comma, flat, cut to MAX_NAME, duplicates (by key)
 * and empty entries dropped, at most MAX_BANNED. Pure; the setting is read by the caller.
 */
export function parseBanned(text) {
    const out = [];
    const seen = new Set();
    for (const raw of String(text ?? '').split(/[\n,]/)) {
        const name = cleanName(raw);
        const key = nameKey(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(name);
        if (out.length >= MAX_BANNED) break;
    }
    return out;
}
