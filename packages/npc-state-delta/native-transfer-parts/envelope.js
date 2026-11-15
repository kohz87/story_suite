// The binary envelope of a native bundle: reading its header and manifest, and writing the augmented envelope.

const MAGIC_BYTES = 8;
const HEADER_BYTES = 12;
export const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
export const MAX_NATIVE_BYTES = 32 * 1024 * 1024;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error('NPC State Delta native import must be binary data.');
}

export function parseEnvelope(input) {
    const value = bytes(input);
    if (value.byteLength < HEADER_BYTES) throw new Error('NPC State Delta bundle is truncated.');
    const manifestLength = new DataView(value.buffer, value.byteOffset, value.byteLength).getUint32(MAGIC_BYTES, true);
    const binaryStart = HEADER_BYTES + manifestLength;
    if (!manifestLength || manifestLength > MAX_MANIFEST_BYTES || binaryStart > value.byteLength) throw new Error('NPC State Delta bundle manifest is truncated or exceeds the 2 MB safety limit.');
    let manifest;
    try { manifest = JSON.parse(textDecoder.decode(value.subarray(HEADER_BYTES, binaryStart))); }
    catch { throw new Error('NPC State Delta bundle manifest is invalid JSON.'); }
    return { value, manifest, binaryStart, binary: value.subarray(binaryStart) };
}

export function encodeAugmentedEnvelope(value, manifest, binary) {
    const manifestBytes = textEncoder.encode(JSON.stringify(manifest));
    const total = HEADER_BYTES + manifestBytes.length + binary.length;
    return { manifestBytes, total, build() {
        const output = new Uint8Array(total);
        output.set(value.subarray(0, MAGIC_BYTES), 0);
        new DataView(output.buffer).setUint32(MAGIC_BYTES, manifestBytes.length, true);
        output.set(manifestBytes, HEADER_BYTES);
        output.set(binary, HEADER_BYTES + manifestBytes.length);
        return output;
    } };
}
