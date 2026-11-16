// Proof evidence, re-read reuse: which stored identities, receipts and proof a Re-read of a record gives again.

import { isObject, occurrenceOf, whole } from '../evidence/constants.js';
import { allocator } from './occurrence.js';
import { operationKey, spanOperationKey } from './operation-key.js';

// The supported guarded spans a Re-read gives again, in record order. Old proofless spans have an id but no occurrence.
function regeneratedSpans(record) {
    const spans = Array.isArray(record?.spans) ? record.spans : [];
    const receipts = Array.isArray(record?.receipts) ? record.receipts : [];
    const out = new Map();
    let at = 0;
    for (const span of spans) {
        const ops = Array.isArray(record?.ops) && Number.isInteger(span?.n) ? record.ops.slice(at, at + span.n) : [];
        at += Number.isInteger(span?.n) ? span.n : 0;
        if (!isObject(span) || typeof span.id !== 'string') continue;
        const key = occurrenceOf(span) !== null || !span.evidence?.length ? spanOperationKey(span) : null;
        if (!key) continue;
        const rev = [...ops].reverse().find(op => op?.path === '/meta/rev' && Number.isInteger(op.value))?.value;
        const step = !!span.replan && receipts.some(receipt => receipt?.rev === rev && receipt?.afterCapture === true);
        if (span.story !== true && !step) continue;
        (out.get(key) ?? out.set(key, []).get(key)).push(span);
    }
    return out;
}

/**
 * The occurrences for the blocks a Re-read of `record` plans. For an operation whose blocks are as many as before, the k-th block that is
 * given again takes the k-th number of the blocks of that operation it replaces (an unchanged Re-read gives every block its own). When
 * the number of blocks of an operation goes up or down, which old block each new one stands for is not known, so none of that
 * operation's old numbers is given again (`retire`, found with `ambiguous` after a first plan): every block of it takes a number
 * nobody has used, every old proof id of it is retired and what was built on them is hidden. A block with none to take back also takes
 * the next unused one. `peek(key)` → the number the next block of that operation would take; `commit(key, value)` once it was planned;
 * `span(key)` → the stored identity to reuse (including old proofless spans without an occurrence);
 * `ambiguous(planned)` → the operations (keys) whose block count differs from the one it replaces.
 */
export function reusePlan(record, retire = new Set()) {
    const pool = regeneratedSpans(record);
    const olds = Array.isArray(record?.receipts) ? record.receipts : [];
    const storyOlds = olds.filter(receipt => receipt?.cause === 'story' && typeof receipt.line === 'string' && Number.isInteger(receipt.seed));
    const stepOlds = olds.filter(receipt => receipt?.cause === 'system' && receipt.afterCapture === true && Number.isInteger(receipt.seed));
    // A record whose kept receipts and kept blocks do not line up one to one keeps its old step receipts beside the new ones
    // (store/write/replace.js `paired`): a step then takes a fresh id, so one record never holds two receipts with one id.
    const pairedKept = olds.filter(receipt => receipt?.cause !== 'story').length === (Array.isArray(record?.spans) ? record.spans.filter(span => span?.story !== true).length : -1);
    let storyNext = 0;
    const stepUsed = new Set();
    const used = new Map();
    const fresh = allocator(record);
    const span = key => (retire.has(key) ? null : pool.get(key)?.[used.get(key) ?? 0] ?? null);
    return {
        span,
        // The id of the receipt a Re-read's line (type, line mark) or step (type) made before, given again in the order storySeeds / stepSeeds
        // (capture-flow.js) give its seed, so what a command stores from its receipt (a stack's `from`) is the same as live.
        receipt(type, mark) {
            const at = storyOlds.findIndex((receipt, n) => n >= storyNext && receipt.type === type && receipt.line === mark);
            if (at < 0) return undefined;
            storyNext = at + 1;
            return typeof storyOlds[at].id === 'string' ? storyOlds[at].id : undefined;
        },
        stepReceipt(type) {
            if (!pairedKept) return undefined;
            const at = stepOlds.findIndex((receipt, n) => !stepUsed.has(n) && receipt.type === type);
            if (at < 0) return undefined;
            stepUsed.add(at);
            return typeof stepOlds[at].id === 'string' ? stepOlds[at].id : undefined;
        },
        peek(key) {
            return occurrenceOf(span(key)) ?? fresh.peek(key);
        },
        commit(key, value) {
            used.set(key, (used.get(key) ?? 0) + 1);
            if (whole(value) !== null) fresh.note(key, value);
        },
        ambiguous(planned) {
            const counts = new Map();
            for (const piece of planned) {
                const block = piece?.block;
                if (!isObject(block?.operation)) continue;
                let key = null;
                try { key = operationKey(block.operation.type, block.operation.payload); } catch { key = null; }
                if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
            }
            return [...counts].filter(([key, count]) => !retire.has(key) && pool.has(key) && pool.get(key).length !== count).map(([key]) => key);
        },
    };
}

/**
 * The proof of the blocks of a record that a Re-read regenerates (its story lines and its planned steps), in record order. A
 * block regenerated by a Re-read may hold these ids again (its own and nobody else's); an id any other block holds is not
 * given to it (see submitProof).
 */
export function replacedProofs(record) {
    const out = [];
    for (const span of Array.isArray(record?.spans) ? record.spans : []) {
        if (!isObject(span) || typeof span.id !== 'string' || !(span.story === true || span.replan)) continue;
        for (const proof of Array.isArray(span.evidence) ? span.evidence : []) if (isObject(proof)) out.push(proof);
    }
    return out;
}
