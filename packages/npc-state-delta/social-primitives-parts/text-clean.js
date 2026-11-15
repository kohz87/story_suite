/* Whitespace, boundary-aware clipping and key normalization of social text.
   Part of social-primitives.js; social-primitives.js re-exports it. */

function clean(value, max = 500) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizedWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanBoundary(value, max = 500, { ellipsis = true } = {}) {
    const text = normalizedWhitespace(value);
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

function norm(value) {
    return clean(value, 500).normalize('NFKC').toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}'-]+/gu, ' ').trim();
}

export { clean, normalizedWhitespace, cleanBoundary, norm };
