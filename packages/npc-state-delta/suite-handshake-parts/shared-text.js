// Text helpers shared by the NPC profile and dossier-target parts.

export function plainText(value) {
    return typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim() : '';
}

/** `text` within `max` characters: whole words only, ending in an ellipsis when shortened. */
export function trimAtWord(text, max) {
    const value = plainText(text);
    const cap = Math.max(0, Math.floor(Number(max) || 0));
    if (value.length <= cap) return value;
    if (cap < 2) return '';
    const prefix = value.slice(0, cap - 1);
    const cut = value[cap - 1] === ' ' ? prefix.length : prefix.lastIndexOf(' ');
    const head = (cut > 0 ? prefix.slice(0, cut) : prefix).replace(/[\s,;:.|/(\-–—]+$/u, '');
    return head ? `${head}…` : '';
}
