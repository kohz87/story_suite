// Judges image URLs and Font Awesome class names from data: only safe ones are let through.

// Base64 raster data: images only, as the layout renderer allows (LAYOUTS.md): no SVG documents.
const DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/]*={0,2}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
const MAX_URL = 4_000_000;

/**
 * The image URL if it is a base64 `data:image/png|jpeg|gif|webp|avif` URL, an `https:` URL, or a same-origin path from the site root
 * (SillyTavern's avatars: `/thumbnail?type=avatar&file=…`, `/User Avatars/…`, MODULES §F11), else ''.
 * Everything else (http:, javascript:, protocol-relative `//host`, other relative paths, blob:, file:,
 * URLs with credentials) is refused.
 */
export function safeImageUrl(value) {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    if (!text || text.length > MAX_URL || CONTROL.test(text)) return '';
    if (DATA_IMAGE.test(text)) return text;
    // One leading slash and no backslash anywhere: browsers read "//x" and "/\x" as another host.
    if (/^\/(?![/\\])/.test(text) && !text.includes('\\')) return text;
    if (!/^https:\/\//i.test(text) || /\s/.test(text)) return '';
    try {
        const url = new URL(text);
        if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
        return url.href;
    } catch {
        return '';
    }
}

const FA_STYLE = /^(?:fa-(?:solid|regular|brands|light|thin|duotone|sharp)|fa[srlbdt])$/;
const FA_TOKEN = /^fa(?:-[a-z0-9]+)+$/;

/** Font Awesome class tokens for a value like "fa-map", "fa-solid fa-map" or "fas fa-map"; null if not FA. */
export function faClasses(value) {
    if (typeof value !== 'string') return null;
    const tokens = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length || tokens.length > 6) return null;
    if (!tokens.every(token => FA_STYLE.test(token) || FA_TOKEN.test(token))) return null;
    if (!tokens.some(token => !FA_STYLE.test(token))) return null;
    return tokens.some(token => FA_STYLE.test(token)) ? tokens : ['fa-solid', ...tokens];
}
