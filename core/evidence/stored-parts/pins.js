// Evidence, proof pins: the pins in the state's record and the pins a block's ops write under /meta/proofs.

import { isObject } from '../constants.js';
import { escapeKey } from '../../ops.js';

export const pinsOf = state => (isObject(state?.meta?.proofs) ? state.meta.proofs : {});

const unescapeKey = key => key.replace(/~1/g, '/').replace(/~0/g, '~');

/**
 * The pins a list of ops writes under `/meta/proofs`: Map id → pin (null when it is not text). One add or
 * replace of the whole record counts, as claimKeys counts claims; removals do not.
 */
export function proofPins(ops) {
    const out = new Map();
    for (const op of Array.isArray(ops) ? ops : []) {
        if (!isObject(op) || (op.op !== 'add' && op.op !== 'replace') || typeof op.path !== 'string') continue;
        if (op.path === '/meta/proofs') {
            if (isObject(op.value)) for (const [id, pin] of Object.entries(op.value)) out.set(id, typeof pin === 'string' ? pin : null);
        } else if (op.path.startsWith('/meta/proofs/') && !op.path.slice(13).includes('/')) {
            out.set(unescapeKey(op.path.slice(13)), typeof op.value === 'string' ? op.value : null);
        }
    }
    return out;
}

/**
 * A block's ops as they are applied on replay: the record `meta.proofs` is made when the state has none, and a
 * write of the whole record (the first proof of a chat makes one) becomes a write per id, so a block that
 * stays never wipes the pins of the ones before it (a Re-read puts new lines ahead of blocks it keeps), and one
 * whose first-proof block is gone still finds its record.
 */
export function pinOps(state, ops) {
    const out = [];
    let there = isObject(state?.meta?.proofs);
    const make = () => {
        if (!there) out.push({ op: 'add', path: '/meta/proofs', value: {} });
        there = true;
    };
    for (const op of ops) {
        const whole = isObject(op) && op.path === '/meta/proofs' && (op.op === 'add' || op.op === 'replace') && isObject(op.value);
        if (whole) {
            make();
            for (const [id, pin] of Object.entries(op.value)) out.push({ op: 'add', path: `/meta/proofs/${escapeKey(id)}`, value: pin });
        } else {
            if (isObject(op) && typeof op.path === 'string' && op.path.startsWith('/meta/proofs/')) make();
            out.push(op);
        }
    }
    return out;
}
