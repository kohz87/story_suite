// Story Suite v2: stamps a reply's boundary hashes again from the text it ends with. A block is stamped while the reply is read, but the reply's text
// can still change after that (its change block moves into the hidden comment, so prose a model left after the block, such as a copy of the hidden
// marker that was defanged, is then part of the text the hashes cover). Called once the text is final, so a stale hash never exists.

import { readRecord } from '../../persist.js';
import { hashJson, isMetaSpan } from '../../replay.js';
import { payloadHashOf } from '../digest.js';

export function createRestamp(s, deps) {
    const { blockParts, blocksBefore, chainHash, current, list, retain, saver, take, write, writable } = deps;

    return {
        /** Stamps the prefix and payload hashes of the guarded blocks of the reply at `index` from its text as it stands now. True when a hash changed. */
        restampHashes(index) {
            const arr = list();
            const message = arr[index];
            const record = message ? readRecord(message) : null;
            if (!record || !Array.isArray(record.spans) || !record.spans.some(isMetaSpan)) return false;
            const payloadHash = payloadHashOf(message);
            const before = chainHash(arr, index);
            const earlier = [];
            let changed = false;
            const spans = record.spans.map(span => span);
            for (const part of blockParts(record)) {
                const first = isMetaSpan(part.span) ? part.span.boundaries?.[0] : null;
                if (first) {
                    const prefixHash = hashJson({ p: before, k: record.source?.swipeKey, t: payloadHash, b: blocksBefore(earlier) });
                    if (first.prefixHash !== prefixHash || first.payloadHash !== payloadHash) {
                        changed = true;
                        const at = spans.indexOf(part.span);
                        if (at >= 0) spans[at] = { ...part.span, boundaries: part.span.boundaries.map((each, n) => (n === 0 ? { ...each, prefixHash, payloadHash } : each)) };
                        part.span = at >= 0 ? spans[at] : part.span;
                    }
                }
                earlier.push(part);
            }
            if (!changed) return false;
            writable();
            const head = current();
            const atHead = index === head.key.index;
            const taken = take(arr, index, atHead ? head.state : undefined);
            write(taken.message, { ...taken.record, spans });
            saver.touch();
            if (atHead) retain(arr, head.state, head.problems);
            return true;
        },
    };
}
