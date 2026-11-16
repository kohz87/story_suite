// Text encoding for keys: base64url of bytes, the canonical length-prefixed tuple, and the hash of a text.
import { sha256Bytes } from './sha256.js';

export function base64url(bytes) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
        out += alphabet[(chunk >> 18) & 63] + alphabet[(chunk >> 12) & 63];
        if (i + 1 < bytes.length) out += alphabet[(chunk >> 6) & 63];
        if (i + 2 < bytes.length) out += alphabet[chunk & 63];
    }
    return out;
}

// The canonical tuple: each part as `<length in UTF-16 units>:<text>` so no two tuples share a byte string.
export function canonicalTuple(parts) {
    return (Array.isArray(parts) ? parts : []).map(part => { const text = String(part ?? ''); return `${text.length}:${text}`; }).join('|');
}

export function hashText(text) { return base64url(sha256Bytes(String(text ?? ''))); }
