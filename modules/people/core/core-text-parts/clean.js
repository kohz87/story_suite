/* Basic text cleaners: name normalizing, bounded text, boundary cut and de-duplicated lists. */

export function normalizeName(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

export function cleanText(value, max = 1200) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanTextBoundary(value, max = 1200, { ellipsis = true } = {}) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    const cap = Math.max(0, Math.floor(Number(max) || 0));
    if (!text || cap <= 0) return '';
    if (text.length <= cap) return text;
    const reserve = ellipsis && cap > 1 ? 1 : 0;
    const prefix = text.slice(0, Math.max(1, cap - reserve));
    let sentenceCut = -1;
    for (const match of prefix.matchAll(/[.!?](?=\s|$)/g)) sentenceCut = match.index + 1;
    if (sentenceCut >= Math.floor(cap * 0.45)) return prefix.slice(0, sentenceCut).trim();
    let clauseCut = -1;
    for (const match of prefix.matchAll(/[;,](?=\s|$)/g)) clauseCut = match.index;
    if (clauseCut >= Math.floor(cap * 0.45)) return prefix.slice(0, clauseCut).replace(/[|/;,\s]+$/g, '').trim();
    const wordCut = prefix.lastIndexOf(' ');
    if (wordCut <= 0) return '';
    const clipped = prefix.slice(0, wordCut).replace(/[|/;,\s]+$/g, '').trim();
    return clipped && ellipsis ? `${clipped}…` : clipped;
}

export function cleanList(value, maxItems = 8, maxChars = 240) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    for (const item of value) {
        const cleaned = cleanText(item, maxChars);
        const key = normalizeName(cleaned);
        if (!cleaned || !key || seen.has(key)) continue;
        seen.add(key);
        out.push(cleaned);
        if (out.length >= maxItems) break;
    }
    return out;
}
