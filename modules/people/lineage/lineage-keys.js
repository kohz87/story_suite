// Lineage keys: the chained key of one message (its place and every message before it), and the version of the lineage format.
import { branchHash } from './hash.js';

// A saved state whose lineage was written under another version has its lineage dropped when it is read (runtime-hydration-state.js).
export const BRANCH_LINEAGE_VERSION = 5;

function lineageKeys(lineage = []) {
    const source = Array.isArray(lineage) ? lineage : [];
    const keys = [];
    let parent = 'root';
    for (let i = 0; i < source.length; i += 1) {
        parent = branchHash(`${parent}|${i}|${source[i]}`);
        keys.push(parent);
    }
    return keys;
}

export function lineageCheckpointKey(lineage = [], messageId = -1) {
    if (!Number.isInteger(messageId) || messageId < 0) return '';
    return lineageKeys(lineage)[messageId] || '';
}
