// Bytes to base64, in chunks, for the sidecar upload.
// One String.fromCharCode call per 32 KB chunk (as vault.js and portrait-file.js do): building each chunk a
// character at a time cost hundreds of milliseconds per save of a large sidecar on the main thread.
export function bytesToBase64(bytes) {
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const chunkSize = 0x8000;
    const parts = [];
    for (let i = 0; i < input.length; i += chunkSize) {
        parts.push(String.fromCharCode.apply(null, input.subarray(i, Math.min(i + chunkSize, input.length))));
    }
    return globalThis.btoa(parts.join(''));
}
