// Story Director: shared text and whitespace helpers for change-line parsing.

// Only a spaced hyphen ends a key, so `Jean-Luc` and `Hall-Warden` stay whole; em and en
// dashes never appear inside names, so they count with or without spaces. Found by keyDash in one
// pass (it was `/\s*[—–]\s*|\s+-(?:\s+|$)/`, quadratic on a long run of spaces).
export const isSpace = ch => /\s/.test(ch);

export function stripMarkdown(text) {
    return String(text ?? '').replace(/\*\*|__|[*`]/g, '');
}

export function wordCount(text) {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}
