// Evidence, visibility: which proofs of a list are visible on a state (pinned, whole, owned, parents visible).

import { isObject } from '../constants.js';
import { pinOf, pinsOf, proofProblem } from '../stored.js';
import { indexOf, merged } from './lookup.js';

/**
 * The proofs of `list` ([{ proof }], in source order) that are visible on `state`: pinned in its `meta.proofs`
 * with the pin their bytes and parents give, whole, of an owner that owns the kind, given once, and every parent
 * visible too (a cycle is not visible). → Proof[] in the same order. With `only` (a list of ids) just those are
 * looked at, and their parents: the work is theirs, not the whole chat's. `over` ([{ proof }]: this root's, a
 * Re-read's): laid over the list, a proof of the same id shadows the listed one. The walk through parents is a loop,
 * not a recursion, so a chain of any length is read.
 */
export function visibleProofs(state, list, only = null, over = []) {
    const pins = pinsOf(state);
    const base = indexOf(list);
    const top = new Map();
    const twiceTop = new Set();
    for (const { proof } of over) {
        if (!isObject(proof) || typeof proof.id !== 'string') continue;
        if (top.has(proof.id)) twiceTop.add(proof.id);
        else top.set(proof.id, proof);
    }
    const find = id => (top.has(id) ? { proof: top.get(id), twice: twiceTop.has(id) } : { proof: base.byId.get(id), twice: base.twice.has(id) });
    const memo = new Map();
    const visible = start => {
        if (memo.has(start)) return memo.get(start);
        const stack = [{ id: start, proof: null, next: -1 }];
        const onPath = new Set([start]);
        while (stack.length) {
            const frame = stack.at(-1);
            if (frame.next === -1) {
                const { proof, twice } = find(frame.id);
                if (!proof || twice || !Object.hasOwn(pins, frame.id) || proofProblem(proof) || pins[frame.id] !== pinOf(proof, pins)) {
                    memo.set(frame.id, false);
                    onPath.delete(frame.id);
                    stack.pop();
                    continue;
                }
                frame.proof = proof;
                frame.next = 0;
            }
            let ok = true;
            let pushed = false;
            while (frame.next < frame.proof.parents.length) {
                const parent = frame.proof.parents[frame.next];
                if (memo.has(parent)) {
                    if (!memo.get(parent)) { ok = false; break; }
                    frame.next += 1;
                } else if (onPath.has(parent)) {
                    ok = false;     // a cycle
                    break;
                } else {
                    stack.push({ id: parent, proof: null, next: -1 });
                    onPath.add(parent);
                    pushed = true;
                    break;
                }
            }
            if (pushed) continue;
            memo.set(frame.id, ok);
            onPath.delete(frame.id);
            stack.pop();
        }
        return memo.get(start);
    };
    if (only) return only.filter(id => visible(id)).map(id => find(id).proof);
    const all = over.length ? merged(list, over.map(({ proof }) => ({ proof }))) : list;
    return all.map(entry => entry.proof).filter(proof => isObject(proof) && visible(proof.id));
}
