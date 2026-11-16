// Tests for hash and record-id shapes, and the id built from a hash.

import { RECORD_ID } from '../registry/check.js';

const HASH = /^[0-9a-f]{64}$/;
export const isHash = value => typeof value === 'string' && HASH.test(value);

export const isRecordId = value => typeof value === 'string' && RECORD_ID.test(value);
export const hasPrefix = (value, prefix) => isRecordId(value) && value.startsWith(`${prefix}_`);

/** `<prefix>_<8 base36>` from the first 40 bits of a hash. */
export function idFromHash(prefix, hex) {
    const n = parseInt(hex.slice(0, 10), 16);
    return `${prefix}_${n.toString(36).padStart(8, '0')}`;
}
