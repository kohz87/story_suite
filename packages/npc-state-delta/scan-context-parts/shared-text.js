/* NPC State Delta: the small text and name-folding helpers the scan-context parts share. */

export function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
export function norm(value) {
    return text(value).normalize('NFKC').toLocaleLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
