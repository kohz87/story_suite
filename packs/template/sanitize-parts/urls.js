// Story Suite v2: which URLs an attribute may carry (images, links, fragments).

import { PAINT_ATTRS, paintAllowed } from './paint.js';

/** A URL with control characters and spaces removed, lowercased: what a browser would act on. */
const flatUrl = url => String(url).replace(/[\u0000- \u007f]+/g, '').toLowerCase();

/** `https:` or `data:image/…` (not `data:image/svg+xml` with script-y content is still inert in <img>). */
export const isImageUrl = url => {
    const flat = flatUrl(url);
    return flat.startsWith('https:') || flat.startsWith('data:image/');
};
/** `https:` or a same-page `#fragment`. */
export const isLinkUrl = url => {
    const flat = flatUrl(url);
    return flat.startsWith('https:') || flat.startsWith('#');
};

/**
 * Whether an attribute (already allowed by name) may carry this value, for the element. URL attributes
 * are checked here; the template renderer calls it again for every bound value.
 */
export function urlAllowed(tag, name, value) {
    if (PAINT_ATTRS.has(String(name).toLowerCase())) return paintAllowed(value);
    if (name === 'src') return isImageUrl(value);
    if (name === 'href' || name === 'xlink:href') {
        if (tag === 'a') return isLinkUrl(value);
        if (tag === 'image') return isImageUrl(value) || flatUrl(value).startsWith('#');
        return flatUrl(value).startsWith('#');
    }
    return true;
}

/** True for attribute names whose value is a URL (or, for SVG paint and references, may hold one). */
export const isUrlAttr = name => name === 'src' || name === 'href' || name === 'xlink:href' || PAINT_ATTRS.has(String(name).toLowerCase());
