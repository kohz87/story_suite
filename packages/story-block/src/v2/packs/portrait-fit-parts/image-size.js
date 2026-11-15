// The job: reading a picture's pixel size from its file header, and the pixel limit a picture may have to be decoded.

/** The most pixels a picture may have to be decoded (a bitmap takes four bytes each). */
export const MAX_PIXELS = 64 * 1000 * 1000;

/** A picture's width and height from its header (`type`: 'webp' | 'png' | 'jpg', as portraits.js sniffImage says), or null where it cannot be read. */
export function imageSize(bytes, type) {
    if (!type) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    try {
        if (type === 'png') return bytes.length >= 24 ? { width: view.getUint32(16), height: view.getUint32(20) } : null;
        if (type === 'webp') {
            const tag = String.fromCharCode(...bytes.subarray(12, 16));
            if (tag === 'VP8X') return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
            if (tag === 'VP8L') { const bits = view.getUint32(21, true); return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }; }
            if (tag === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
        }
        if (type === 'jpg') {
            for (let at = 2; at + 9 < bytes.length;) {
                if (bytes[at] !== 0xff) { at += 1; continue; }
                const marker = bytes[at + 1];
                if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
                at += 2 + view.getUint16(at + 2);
            }
        }
    } catch { /* a damaged header reads as no size */ }
    return null;
}
