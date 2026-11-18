// Story Suite v2: which SVG attributes are paint or references, and whether such a value is safe.

// SVG attributes read as CSS paint or a reference to another element: `url(#id)` only (SPEC §13.2).
export const PAINT_ATTRS = new Set(['fill', 'stroke', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end', 'filter']);

/**
 * Whether an SVG paint or reference value is safe: a colour or keyword, or `url(#fragment)`; never another
 * document, a loader function, a variable or a CSS escape (which could spell any of these).
 */
export function paintAllowed(value) {
    const flat = String(value ?? '').replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
    if (flat.includes('\\') || /javascript:|vbscript:|expression\(/.test(flat)) return false;
    if (/(?:image-set|image|cross-fade|src|element|var|attr|env)\(/.test(flat)) return false;
    for (const match of flat.matchAll(/url\(/g)) {
        if (!/^url\(['"]?#/.test(flat.slice(match.index))) return false;
    }
    return true;
}
