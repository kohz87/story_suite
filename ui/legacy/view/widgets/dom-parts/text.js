// Plain-text helpers for widget labels: one-line cut text, display strings, initials, readable slugs.

/** A string or number as one trimmed line cut to `max`; anything else is ''. */
export function text(value, max = 300) {
    return typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/gu, ' ').trim().slice(0, max) : '';
}



/** A display string from a text-ish value ('' for null/undefined/objects). */
export function str(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
}

/** Up to two initials from a name ("Ren Avel" → "RA", "astra" → "A"); '?' when there is no name. */
export function initials(name) {
    const words = str(name).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    const first = Array.from(words[0])[0];
    const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
    return `${first}${last}`.toUpperCase();
}

/** "fire-ward" → "fire ward": a readable label from a kind slug. */
export function humanize(value) {
    return str(value).replace(/[-_]+/g, ' ').trim();
}
