// Evidence, block check: whether a block's ops are known changes and its span holds exactly the proof its ops pin.

import { isObject, occurrenceOf } from '../constants.js';
import { parsePath } from '../../ops.js';
import { hashJson } from '../../replay.js';
import { proofProblem } from './proof.js';
import { proofPins } from './pins.js';
import { proofWriteProblem } from './branch.js';

const KNOWN_OPS = ['add', 'replace', 'remove'];

/**
 * '' when every change of `ops` is a change the state knows: an object with add, replace or remove, a path that reads, and
 * a value where it adds or replaces. A block with a change that is not one is not applied and gives no proof.
 */
export function opShapeProblem(ops) {
    if (!Array.isArray(ops)) return 'its changes are not a list';
    for (const op of ops) {
        if (!isObject(op) || !KNOWN_OPS.includes(op.op) || typeof op.path !== 'string') return 'a change of the block is not an add, replace or remove with a path';
        // (a plain path with no escapes reads as it is)
        if (op.path !== '' && (op.path[0] !== '/' || op.path.includes('~'))) {
            try { parsePath(op.path); } catch { return 'a change of the block has a path that cannot be read'; }
        }
        if (op.op !== 'remove' && !Object.hasOwn(op, 'value')) return 'a change of the block adds or replaces with no value';
    }
    return '';
}

/**
 * '' when a block's span holds exactly the proof its ops pin (and each proof is whole, carries the span's
 * Source and is given once), else why not. Asked when the block is stored and again when it is replayed.
 */
export function evidenceProblem(span, ops) {
    const list = Array.isArray(span?.evidence) ? span.evidence : [];
    const pins = proofPins(ops);
    const ids = new Set();
    const writes = proofWriteProblem(ops, new Set(list.map(proof => proof?.id)), { erases: span?.module === 'story-block' && span?.operation?.type === 'savepoint.restore' });
    if (writes) return writes;
    const shape = opShapeProblem(ops);
    if (shape) return shape;
    // A block with proof and no occurrence is from a build before proof was released: not supported, so it fails closed.
    if (list.length && occurrenceOf(span) === null) return 'its proof has no occurrence (a block written before proof was released is not supported)';
    for (const proof of list) {
        const why = proofProblem(proof);
        if (why) return `a proof of the block is not whole: ${why}`;
        if (hashJson(proof.source) !== hashJson(span.source)) return 'a proof of the block carries another source than the block';
        if (ids.has(proof.id)) return `proof ${proof.id} is given twice`;
        ids.add(proof.id);
        if (typeof pins.get(proof.id) !== 'string') return `the block's changes do not pin proof ${proof.id}`;
    }
    if (pins.size !== ids.size) return 'the block\'s changes pin proof that it does not hold';
    return '';
}
