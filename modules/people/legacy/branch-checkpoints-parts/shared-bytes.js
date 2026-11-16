// Byte size of one stored checkpoint, shared by normalizing and pruning.

import { utf8Bytes } from '../branch-util.js';

export function checkpointBytes(item) {
    return utf8Bytes(item?.snapshot || {}) + 256;
}
