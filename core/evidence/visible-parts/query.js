// Evidence, the story.evidence query: the visible proof in source order or in the order of the ids asked for.

import { LIMITS, isObject } from '../constants.js';
import { isRecordId } from '../../replay.js';
import { visibleProofs } from './proofs.js';

/**
 * The `story.evidence` query (contract §6): `({ ids? }) → Proof[]`, the visible proof in source order, or in
 * the order of `ids` (once each) when they are given; unknown ids are left out and malformed arguments give [].
 * `stored()` → the stored entries (store.proofs); inside a command the transaction's own pending proofs come
 * with the query's tools (`tools.pendingProofs`), so a nested command sees them and a public query does not.
 */
export function createEvidenceQuery({ stored = () => [] } = {}) {
    return function storyEvidence(state, args, tools) {
        let ids = null;
        if (args !== undefined) {
            if (!isObject(args) || Object.keys(args).some(key => key !== 'ids')) return [];
            if (args.ids !== undefined) {
                if (!Array.isArray(args.ids) || args.ids.length > LIMITS.ids) return [];
                for (let at = 0; at < args.ids.length; at += 1) if (!(at in args.ids) || !isRecordId(args.ids[at])) return [];
                ids = [...new Set(args.ids)];
            }
        }
        let pending = [];
        try { pending = typeof tools?.pendingProofs === 'function' ? tools.pendingProofs() ?? [] : []; } catch { pending = []; }
        return visibleProofs(state, stored() ?? [], ids, pending);
    };
}
