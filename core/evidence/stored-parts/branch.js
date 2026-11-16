// Evidence, the proof record's branch: which ops reach /meta/proofs and which of them a block may write.

import { isObject } from '../constants.js';
import { parsePath } from '../../ops.js';

/**
 * True when `path` reaches `branch` (a list of keys): it names the branch, something below it, or something that holds it, any
 * ancestor up to the document root. A path that cannot be read counts, since nothing can say it does not; no path (`undefined`) does not.
 * The rule for every record only some blocks may write (the proof pins here, the host's savepoints in the store).
 */
export function reachesBranch(path, branch) {
    if (path === undefined) return false;
    let keys;
    try { keys = parsePath(path); } catch { return true; }
    for (let at = 0; at < Math.min(keys.length, branch.length); at++) if (keys[at] !== branch[at]) return false;
    return true;
}

const PROOF_BRANCH = ['meta', 'proofs'];

// The keys of an op's path (or `from`) when it names the state's proof record or something that holds it: the document
// root, `/meta`, `/meta/proofs` or anything under it. An unreadable path counts, since nothing can say it does not.
function touchedKeys(path) {
    if (!reachesBranch(path, PROOF_BRANCH)) return null;
    try { return parsePath(path); } catch { return []; }
}

/** True when `op` changes the record of proof pins, or something that holds it (the root, /meta, /meta/proofs, below it): any op, add, replace, remove, move or copy, whole or empty. */
export const touchesProof = op => !isObject(op) || touchedKeys(op.path) !== null || touchedKeys(op.from) !== null;

/**
 * '' when the only changes `ops` make to the record of proof pins are the pins of `owned` (a Set of proof ids): a pin
 * added (or replaced) under its own id, or the whole record written with just those. Anything else that touches it
 * (an erase, a rewrite of /meta or of the root, a pin that is not its own, a move or a copy) is why not. `erases`: the
 * host's restore may also erase single pins.
 */
export function proofWriteProblem(ops, owned, { erases = false } = {}) {
    for (const op of Array.isArray(ops) ? ops : []) {
        if (!touchesProof(op)) continue;
        if (!isObject(op)) return 'a change of the block is not a change at all';
        const keys = touchedKeys(op.path);
        const writes = isObject(op) && (op.op === 'add' || op.op === 'replace') && op.from === undefined && keys !== null;
        if (writes && keys.length === 3 && keys[1] === 'proofs' && owned.has(keys[2]) && typeof op.value === 'string') continue;
        // The host's restore (docs/v2/TIMELINE.md) takes back the pins the faded story gave: an erase of one pin, nothing more.
        if (erases && isObject(op) && op.op === 'remove' && op.from === undefined && keys !== null && keys.length === 3 && keys[1] === 'proofs') continue;
        if (writes && keys.length === 2 && keys[1] === 'proofs' && isObject(op.value) && Object.keys(op.value).length > 0 && Object.entries(op.value).every(([id, pin]) => owned.has(id) && typeof pin === 'string')) continue;
        return `it changes the record of proof pins in a way a block cannot (${isObject(op) ? `${op.op} ${op.path ?? ''}` : 'an unreadable change'})`;
    }
    return '';
}
