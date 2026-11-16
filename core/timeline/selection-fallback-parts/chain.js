// The fallback chain of a module's saved points and the verify-then-prepare walk along it.

import { stateHash } from '../host-block.js';
import { boundaryMatches, canFallback } from './boundary.js';

const oldestFirst = (a, b) => a.index - b.index || a.op - b.op || a.mapping.seq - b.mapping.seq;
const targetOf = value => ({ module: value.module, checkpoint: value.checkpoint, hash: value.hash, schema: value.schema });
const sameTarget = (from, candidate) => !!from && (typeof from === 'string' ? from === candidate.checkpoint
    : from.checkpoint === candidate.checkpoint && (from.hash === undefined || from.hash === candidate.hash));

/**
 * `createSelectionFallback({ archive, store, witnessStateHash })` closes over the timeline's archive
 * and store. It returns:
 *   - `fallbackChain(module, limit?)`: matching targets newest first, then `archive.baseline()[module]`;
 *   - `walkSelectionFallback(module, options)`: the verify-then-prepare walk (below).
 * `witnessStateHash` is the selection plan's memoising hasher when the coordinator supplies one.
 */
export function createSelectionFallback({ archive, store, witnessStateHash = stateHash }) {
    function fallbackChain(module, limit = null) {
        if (!archive.exists()) return [];
        return (store.witnessScope ?? (read => read()))(() => {
            const through = limit ? store.prefixWitness(limit) : null;
            if (limit && !through) throw new Error('The marker root no longer has a unique prefix.');
            const candidates = [];
            for (const mapping of archive.prefixes(module)) {
                if (!mapping.boundary || !mapping.after) continue;
                const witness = store.prefixWitness(mapping.boundary.cursor);
                if (boundaryMatches(mapping, witness, { through, stateHashOf: witnessStateHash })) {
                    candidates.push({ mapping, index: witness.index, op: witness.op });
                }
            }
            candidates.sort(oldestFirst);
            candidates.reverse();
            const chain = candidates.map(({ mapping, index, op }) => ({
                ...mapping.after, module, source: 'prefix', index, op, seq: mapping.seq,
            }));
            const baseline = archive.baseline()[module];
            if (baseline) chain.push({ ...baseline, module, source: 'baseline', index: null, op: null, seq: null });
            return chain;
        });
    }

    /**
     * Walk the chain from newest to oldest, skipping `from` (the head target whose prepare failed).
     * With `verify`, each candidate is read-only checked first; the first that verifies is prepared.
     * Without `verify`, prepare is the check. A successful prepare returns
     * `{ ok: true, target, prepared, fell }`, where `fell` is exactly
     * `{ module, from, to, replies }`; `replies` is the number of later chat replies when `headIndex`
     * is given, else null. A permanent candidate failure walks on. Any other failure is returned at
     * once. If nothing works, `failure` (the original prepare failure) is returned unchanged, as the
     * block stays today. Nothing here installs a checkpoint.
     */
    async function walkSelectionFallback(module, { from = null, headIndex = null, countReplies = null, verify = null, prepare, failure = null, chain = fallbackChain(module) } = {}) {
        if (typeof prepare !== 'function') throw new TypeError('walkSelectionFallback needs a prepare callback.');
        const tried = [];
        // The selected point may have left the current head while its prepare was waiting. Do not
        // mistake a newer point on the changed head for an earlier fallback in that case.
        const start = from ? chain.findIndex(target => sameTarget(from, target)) : -1;
        // (the head moved: the unfinished selection is planned again by the caller, not blocked for good)
        if (from && start < 0) return { ok: false, code: 'STALE', replan: true, message: 'The selected point is no longer on this head.' };
        for (const target of chain.slice(start + 1)) {
            if (sameTarget(from, target)) continue;
            if (from && target.schema !== from.schema) continue;
            const attempt = { checkpoint: target.checkpoint, hash: target.hash };
            tried.push(attempt);
            if (typeof verify === 'function') {
                const answer = await verify({ checkpoint: target.checkpoint, hash: target.hash });
                if (answer?.ok !== true) {
                    attempt.code = answer?.code ?? 'FAILED';
                    if (!canFallback(attempt.code)) return { ...answer, ok: false, code: attempt.code, target, tried };
                    continue;
                }
            }
            const prepared = await prepare({ checkpoint: target.checkpoint, hash: target.hash });
            if (prepared?.ok !== true) {
                attempt.code = prepared?.code ?? 'FAILED';
                if (!canFallback(attempt.code)) return { ...prepared, target, tried };
                continue;
            }
            if (prepared.hash !== target.hash) {
                return { ok: false, code: 'CONFLICT', message: 'The participant prepared other selected bytes.', target, tried };
            }
            const replies = countReplies ? countReplies(target.index) : (Number.isInteger(headIndex) && Number.isInteger(target.index)
                ? Math.max(0, headIndex - target.index) : null);
            return { ok: true, target, prepared, tried, fell: { module, from: from ? targetOf(from) : null, to: targetOf(target), replies } };
        }
        return failure ?? { ok: false, code: 'SNAPSHOT_UNAVAILABLE', message: 'No earlier saved point could be checked.', tried };
    }

    return { fallbackChain, walkSelectionFallback };
}
