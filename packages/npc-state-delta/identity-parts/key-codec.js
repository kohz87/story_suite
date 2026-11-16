/* Chat key part codec: percent-encodes and decodes one segment of a qualified chat key. */

export function encodeChatKeyPart(value) {
    return encodeURIComponent(String(value ?? '').trim());
}

export function decodeChatKeyPart(value) {
    try { return decodeURIComponent(String(value ?? '')); }
    catch { return String(value ?? ''); }
}
