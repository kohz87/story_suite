// Value checks for image URLs and theme token values.
import { LIMITS } from './limits.js';

// Images: https (no user:password) or a base64 data: image in a raster format. SVG is
// left out: it is a document, not a picture.
const DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/;
export function imageUrlError(src) {
    if (typeof src !== 'string' || !src) return 'an image needs a URL';
    if (/^data:/i.test(src)) {
        if (src.length > LIMITS.urlData) return 'a data: image is larger than 200 KB';
        return DATA_IMAGE.test(src) ? '' : 'a data: image must be base64 PNG, JPEG, GIF, WebP or AVIF';
    }
    if (!/^https:\/\//i.test(src)) return `"${src.slice(0, 60)}" is not an allowed image URL (use https: or a data: image)`;
    if (src.length > LIMITS.urlHttps) return 'an image URL is longer than 2048 characters';
    let url;
    try {
        url = new URL(src);
    } catch {
        return `"${src.slice(0, 60)}" is not a valid URL`;
    }
    if (url.protocol !== 'https:') return 'an image URL must use https:';
    if (url.username || url.password) return 'an image URL must not carry a user name or password';
    return '';
}

// Token values: colours, lengths and font names. No url(), no var(), no ; { } < > \ / :
const TOKEN_VALUE = /^[#a-zA-Z0-9 .,%'"()+-]{1,64}$/;
const TOKEN_FUNCTIONS = new Set(['rgb', 'rgba', 'hsl', 'hsla']);
export function tokenValueError(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return '';
    if (typeof value !== 'string' || !TOKEN_VALUE.test(value)) return 'must be a colour, a length or a font name (letters, digits, # . , % ( ) quotes)';
    for (const match of value.matchAll(/([a-zA-Z-]*)\s*\(/g)) {
        if (!TOKEN_FUNCTIONS.has(match[1].toLowerCase())) return `may not use "${match[1] || '('}(": only rgb(), rgba(), hsl(), hsla()`;
    }
    return '';
}
