// Story Suite v2: what a seal compares before and after it is staged (docs/dev/saves-and-persist.md "Sealed history"). A seal is written only
// when the chat rebuilt from the new base reads exactly as it read before: the head state, its Problems, the replan point, the proof (both
// lists), the receipts and the untold ones (less what a sealed receipt drops), and in the window each carrier's chain hash and the guarded
// blocks whose boundary no longer fits. `sealSnapshot` reads them; `sealDiff` names the first that differs, or ''.

import { hashJson } from '../../replay.js';

// A receipt as a sealed one keeps it (persist/sealed.js drops what only a guarded replay reads).
const bare = receipt => {
    if (!receipt || typeof receipt !== 'object') return receipt;
    const { seed, replan, ...rest } = receipt;
    void seed; void replan;
    return rest;
};

/**
 * Everything a seal must leave as it was, for the chat as it reads now. `edge`: the first carrier after the replies being sealed (window
 * carriers are compared from it on). `reads`: the store's own reads ({ head, problems, replansFrom, proofs, receipts, untold,
 * boundaryProblems, chainHash, list }).
 */
export function sealSnapshot(reads, edge) {
    const arr = reads.list();
    const head = reads.head();
    const chains = [];
    for (let i = edge; i <= arr.length; i++) chains.push(reads.chainHash(arr, i));
    const replan = reads.replansFrom();
    return {
        head: hashJson(head),
        problems: hashJson(reads.problems().map(({ message, ...rest }) => { void message; return rest; })),
        replan: replan === null ? null : replan,
        proofs: hashJson(reads.proofs()),
        proofsAll: hashJson(reads.proofs({ all: true })),
        receipts: hashJson(reads.receipts().map(entry => ({ index: entry.index, receipt: bare(entry.receipt) }))),
        untold: hashJson(reads.untold().map(bare)),
        chains: hashJson(chains),
        boundary: hashJson(reads.boundaryProblems().filter(each => each.index >= edge)),
    };
}

/**
 * The first part of `after` that is not what `before` was, or '' when none. The replan point may move to the edge or past it: the steps
 * before the edge are sealed and are never planned again, so a reconcile there plans the window's own steps only.
 */
export function sealDiff(before, after, edge) {
    for (const key of ['head', 'problems', 'proofs', 'proofsAll', 'receipts', 'untold', 'chains', 'boundary']) {
        if (before[key] !== after[key]) return key;
    }
    if (before.replan === null || before.replan >= edge) return after.replan === before.replan ? '' : 'replan';
    return after.replan !== null && after.replan < edge ? 'replan' : '';
}
