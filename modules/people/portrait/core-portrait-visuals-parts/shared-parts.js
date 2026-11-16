// Shared portrait-part helpers: the normalized key of an appearance fragment and de-duplication of fragment lists.
import { normalizeName } from '../../core/core-text.js';

export function portraitPartKey(value) {
    return normalizeName(value).replace(/\b(?:a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

export function uniquePortraitParts(values = []) {
    const seen = new Set();
    const result = [];
    for (const raw of values) {
        const value = String(raw ?? '').replace(/\s+/g, ' ').replace(/^[,;:\s]+|[,;:\s]+$/g, '').trim();
        if (!value) continue;
        const key = portraitPartKey(value);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(value);
    }
    return result;
}
