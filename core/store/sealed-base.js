// Story Suite v2: the base of a sealed chat (docs/dev/saves-and-persist.md "Sealed history"). Once the replies older than the retention
// window are sealed, the state just after the last of them lives in the chat's metadata (`storySuite.base`), with the hashes the chain had in
// front of the first reply after them (`anchors`), the Problems and the proof of the blocks before it. Replay starts there; every hash in the
// window goes on from the anchors, so a seal changes none of them. This part reads the base and says whether this chat may use it:
// * 'ok'      the sealed replies are the ones the base was made over (a branch made inside the window too: it takes the branch's id);
// * 'drift'   the same file (its chat id and SillyTavern's `integrity` both as the base has them) lost a sealed reply or more: the base is
//             used, their changes stay;
// * 'branch'  another file cut before the edge (a SillyTavern branch or checkpoint; before SillyTavern 1.19 a branch kept its parent's
//             `integrity`, so the chat id tells them apart): it lacks replies the base holds, so it is read-only;
// * 'missing' sealed replies and no base (or replies sealed after unsealed ones): read-only;
// * 'none'    nothing is sealed.

import { KEY, carrierIndexes, readRecord } from '../persist.js';
import { isSealed } from '../persist/sealed.js';
import { isObject, deepFreeze } from './constants.js';
import { hashJson } from '../replay.js';
import { HISTORY_STRINGS } from '../strings/history.js';

/** The digest of the sealed replies' ids, in order. */
export const sealedDigest = sids => hashJson({ sealed: sids });

const READ_ONLY = HISTORY_STRINGS.branchTooOld;
const MISSING = HISTORY_STRINGS.baseMissing;

const refOf = message => [message, message?.extra?.[KEY], message?.swipe_id, message?.mes];
const same = (message, ref) => refOf(message).every((value, at) => value === ref[at]);
const NONE = Object.freeze({ status: 'none', start: -1, last: -1, sids: Object.freeze([]) });

export function createSealedBase(s, { list, metadata, chatId = () => undefined, changed = () => {} }) {
    const metaNow = () => { try { const meta = metadata(); return isObject(meta) ? meta : null; } catch { return null; } };
    const baseNow = () => {
        const base = metaNow()?.storySuite?.base;
        return isObject(base) && base.v === 1 && isObject(base.state) && isObject(base.anchors) ? base : null;
    };
    const frozen = new WeakMap();      // base → its state, deep-frozen once

    // The sealed carriers of `arr` (shown records), and where the window starts. A sealed reply after an unsealed one breaks the edge.
    function scan(arr) {
        const sealed = [];
        let start = -1;
        let broken = false;
        for (const i of carrierIndexes(arr)) {
            const record = readRecord(arr[i]);
            if (!record) continue;
            if (isSealed(record)) {
                if (start >= 0) broken = true;
                sealed.push({ index: i, sid: record.sid });
            } else if (start < 0) start = i;
        }
        return { sealed, start, broken };
    }

    // → { status, base?, start, last, sids, state?, ... } for `arr` as it is now. A chat with no base and an unsealed first reply is read at
    // once (a chat is sealed from its start); else the answer is kept while the chat, the base and the file id are the same and every sealed
    // message (and the first one after them) is the same object with the same record, swipe and text: a look at those, not a read of each.
    function historyOf(arr = list()) {
        const base = baseNow();
        if (!base) {
            // (the first message that holds a record: a system note or an older greeting in front of it holds none)
            const first = arr.find(message => message && !message.is_user && message.extra?.[KEY] !== undefined);
            if (!isSealed(first ? readRecord(first) : null)) return NONE;
        }
        const integrity = metaNow()?.integrity;
        const hit = s.history;
        if (hit && hit.arr === arr && hit.length === arr.length && hit.chat === chatId() && hit.base === base
            && hit.digest === base?.sealedDigest && hit.integrity === integrity && hit.refs.every(([i, ...ref]) => same(arr[i], ref))) return hit.out;
        const { sealed, start, broken } = scan(arr);
        const sids = sealed.map(each => each.sid);
        const last = sealed.length ? sealed.at(-1).index : -1;
        let out;
        if (!sealed.length) out = { status: 'none', start: -1, last: -1, sids };
        else if (!base || broken) out = { status: 'missing', start, last, sids };
        else {
            const same = sealedDigest(sids) === base.sealedDigest;
            const file = sameFile(base);
            const status = same ? 'ok' : file ? 'drift' : 'branch';
            // (no reply after the sealed ones, a chat cut back to them: the window starts right after the last of them, at the base)
            out = { status, base, start: start >= 0 ? start : last + 1, last, sids, usable: status !== 'branch' };
            if (out.usable) {
                let state = frozen.get(base);
                if (!state) frozen.set(base, state = deepFreeze(structuredClone(base.state)));
                out.state = state;
            }
        }
        const refs = [...sealed.map(each => each.index), ...(start >= 0 ? [start] : [])].map(i => [i, ...refOf(arr[i])]);
        s.history = { arr, length: arr.length, chat: chatId(), base, digest: base?.sealedDigest, integrity, refs, out };
        return out;
    }

    // The same file as the base was made in: the chat id and `integrity` both match (one of them known). Anything else is taken as another file.
    function sameFile(base) {
        const id = chatId() ?? null;
        const integrity = metaNow()?.integrity ?? null;
        return id === (base.chat ?? null) && integrity === (base.integrity ?? null) && (id !== null || integrity !== null);
    }

    /** The base to replay from for `arr`, or null (nothing sealed, or a base this chat may not use). */
    function usableBase(arr) {
        const history = historyOf(arr);
        return history.usable ? history : null;
    }

    // The proof of the blocks that applied before the base, as store.proofs lists it ({ proof, block, index }: the index of the sealed reply that
    // gave it, -1 once that reply is gone), for a read that starts at or after the base; [] otherwise.
    const proofLists = new WeakMap();
    function baseProofs(arr, upTo) {
        const history = usableBase(arr);
        if (!history || upTo < history.start || !Array.isArray(history.base.proofs)) return [];
        const hit = proofLists.get(history.base);
        if (hit && hit.arr === arr && hit.key === history.sids.join('\u0000')) return hit.out;
        const at = new Map(history.sids.map((sid, n) => [sid, n]));
        const indexes = carrierIndexes(arr).filter(i => isSealed(readRecord(arr[i])));
        const out = Object.freeze(history.base.proofs.filter(isObject).map(each => Object.freeze({
            proof: deepFreeze(structuredClone(each.proof)), block: each.block, index: at.has(each.sid) ? indexes[at.get(each.sid)] : -1 })));
        proofLists.set(history.base, { arr, key: history.sids.join('\u0000'), out });
        return out;
    }

    /** Why a chat whose replies are sealed has no state here (store/tombs.js preservedAt: read-only), or null. */
    function sealedKept(arr) {
        const history = historyOf(arr);
        if (history.status !== 'branch' && history.status !== 'missing') return null;
        const first = carrierIndexes(arr).find(i => readRecord(arr[i])) ?? 0;      // (the first message that holds a record)
        return { index: first, kind: 'sealed', why: history.status === 'branch' ? READ_ONLY : MISSING, raw: null };
    }

    /**
     * After a rebuild: the base takes what this file is now. Sealed replies that went (the same file) are taken as gone, their changes staying
     * in the base: → 'deleted' (the reader is told once; a save is asked for, as SillyTavern may have saved the delete already). A branch made
     * inside the window (or a renamed file) takes the file's chat id and `integrity`. → '' otherwise. Those are in memory: the next save writes them.
     */
    function settleHistory(arr = list()) {
        const history = historyOf(arr);
        const meta = metaNow();
        if (!meta || !history.base || !history.usable) return '';
        const base = history.base;
        let told = '';
        if (history.status === 'drift') {
            base.sealedDigest = sealedDigest(history.sids);
            base.count = history.sids.length;
            if (!history.sids.includes(base.through)) base.through = history.sids.at(-1) ?? base.through;
            told = 'deleted';
        }
        if ((meta.integrity ?? null) !== (base.integrity ?? null)) base.integrity = meta.integrity ?? null;
        if ((chatId() ?? null) !== (base.chat ?? null)) base.chat = chatId() ?? null;
        s.history = null;
        if (told) changed();
        return told;
    }

    return { historyOf, usableBase, baseProofs, sealedKept, settleHistory };
}
