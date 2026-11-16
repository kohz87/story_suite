// Data URLs of portrait images: parsing a raster data URL within the size limit and building one from bytes.
/** The most bytes one portrait file may hold (Story Block's cast limit is 150 KB; a little room above it). */
export const PORTRAIT_FILE_MAX_BYTES = 300 * 1024;

const DATA_IMAGE = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i;

/** { type, base64, bytes } of a raster data URL (png, jpeg, webp) within the size limit, else null. */
export function parseImageDataUrl(dataUrl) {
    const match = DATA_IMAGE.exec(String(dataUrl || ''));
    if (!match || typeof globalThis.atob !== 'function') return null;
    let binary;
    try { binary = globalThis.atob(match[2]); } catch { return null; }
    if (!binary.length || binary.length > PORTRAIT_FILE_MAX_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { type: match[1].toLowerCase(), base64: match[2], bytes };
}

/** A data URL from bytes (a file read back). */
export function dataUrlOfBytes(bytes, type) {
    const parts = [];
    for (let i = 0; i < bytes.length; i += 0x8000) parts.push(String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length))));
    return `data:${type};base64,${globalThis.btoa(parts.join(''))}`;
}
