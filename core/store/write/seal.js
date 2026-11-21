// Story Suite v2: sealing old story history (docs/dev/saves-and-persist.md "Sealed history"). The replies older than the retention window are
// sealed in steps (persist/sealed.js): they keep their text, ids and receipts and lose what only replay reads, and the state just after the
// last of them becomes the chat's base (`storySuite.base` in its metadata, store/sealed-base.js), with the hashes the chain had there so
// every hash in the window goes on as it was. The seal is staged in place, the chat is read again from the new base, and it is kept only
// when everything reads exactly as before (write/seal-check.js); else every object is put back as it was, synchronously, and nothing is saved.

import { carrierIndexes, readRecord, KEY } from '../../persist.js';
import { isSealed, sealRecord } from '../../persist/sealed.js';
import { isObject } from '../constants.js';
import { hasMeta } from '../digest.js';
import { hashJson } from '../../replay.js';
import { sealedDigest } from '../sealed-base.js';
import { sealSnapshot, sealDiff } from './seal-check.js';

/** How many replies to seal in a chat with `count` replies (all of them sealed or not): a multiple of `step` leaving at least `window`. */
export function sealCount(count, { window, step }) {
    return count <= window ? 0 : step * Math.floor((count - window) / step);
}

export function createSeal(s, deps) {
    const { list, metadata, current, replay, stateBefore, appliedOf, chainHash, bareHash, spineBefore, windowHash, packProblems, rawSidAt, proofsBefore, historyOf,
        forgetMemos, saver, keptNow, sealing, reads, chatId } = deps;
    const refused = new Set();      // the chats whose seal was refused (the rebuilt story differed): not tried again until the next build

    // Puts every staged change back (in reverse) and drops what was read meanwhile.
    function undo(changes) {
        for (let n = changes.length - 1; n >= 0; n--) {
            const [holder, key, had, value] = changes[n];
            if (had) holder[key] = value;
            else delete holder[key];
        }
        s.cache = null;
        s.history = null;
        forgetMemos();
    }
    const set = (changes, holder, key, value) => {
        changes.push([holder, key, Object.hasOwn(holder, key), holder[key]]);
        holder[key] = value;
    };

    // A checkpoint after the edge: one that does not hold the state in front of it (made before a delete or an edit; the chain passes it over
    // today) goes (the replay starts from the base or an earlier one instead); one that does gets its covers as the window is now: the records
    // from the checkpoint before it (or the edge) to the one before it.
    const CHAIN_FIELDS = ['checkpoint', 'covers', 'coverHash', 'prefix', 'guardEnv', 'carried', 'owned'];
    function recover(arr, at, changes, stale) {
        const record = readRecord(arr[at]);
        if (!record?.checkpoint) return;
        if (stale.has(at)) {
            const next = { ...record };
            for (const field of CHAIN_FIELDS) delete next[field];
            put(arr, at, record, next, changes);
            return;
        }
        if (!Array.isArray(record.covers)) return;
        const members = [];
        for (let i = at - 1; i >= 0; i--) {
            const each = readRecord(arr[i]);
            if (!each || isSealed(each)) { if (each) break; continue; }
            members.unshift(i);
            if (each.checkpoint) break;
        }
        const next = { ...record, covers: members.map(i => readRecord(arr[i]).sid) };
        const hash = windowHash(arr, members);
        if (hash === undefined) delete next.coverHash;
        else next.coverHash = hash;
        put(arr, at, record, next, changes);
    }
    function put(arr, at, record, next, changes) {
        set(changes, arr[at].extra, KEY, next);
        const info = Array.isArray(arr[at].swipe_info) ? arr[at].swipe_info[arr[at].swipe_id ?? 0] : null;
        if (isObject(info?.extra) && info.extra !== arr[at].extra && info.extra[KEY]?.sid === record.sid) set(changes, info.extra, KEY, structuredClone(next));
    }
    /**
     * Seals what is due: → { ok: true, sealed: 0 } (nothing due), { ok: true, sealed, through, from } or { ok: false, why }. Never during a
     * Re-read or a reconcile, nor on a chat that is read-only, has a damaged record at its head or a sealed history it may not use.
     */
    function seal() {
        const arr = list();
        if (s.staged || s.applying || keptNow()) return { ok: false, why: 'busy' };
        const chat = String(chatId() ?? '');
        if (refused.has(chat)) return { ok: false, why: 'refused before' };
        const history = historyOf(arr);
        if (history.status !== 'none' && history.status !== 'ok') return { ok: false, why: history.status };
        const head = current();
        if (!head.state || head.readOnly) return { ok: false, why: 'no state' };
        if (head.problems.some(problem => problem.code === 'DAMAGED')) return { ok: false, why: 'damaged' };
        const carriers = carrierIndexes(arr).filter(i => readRecord(arr[i]));
        const k = sealCount(carriers.length, sealing);
        const already = history.sids?.length ?? 0;
        if (k <= already) return { ok: true, sealed: 0 };
        const through = carriers[k - 1];
        const edge = carriers[k];
        const meta = metadata();
        if (!isObject(meta)) return { ok: false, why: 'no metadata' };
        // The base: the state after the last reply sealed (the prefix memo has it when the head was replayed through it), the head's own
        // Problems and proof before the edge, and the chain's hashes in front of the edge. The check below replays the window from it.
        const at = stateBefore(arr, edge);
        if (!at) return { ok: false, why: 'no state at the edge' };
        const seen = new Set();
        const proofs = [];
        for (const entry of [...proofsBefore(arr, head.from ?? -1), ...appliedOf(arr, head)]) {
            if (entry.index > through || seen.has(entry.proof.id)) continue;
            seen.add(entry.proof.id);
            proofs.push({ sid: rawSidAt(arr, entry.index), block: entry.block, proof: structuredClone(entry.proof) });
        }
        const old = history.status === 'ok' ? history.base : null;
        const sids = carriers.slice(0, k).map(i => readRecord(arr[i]).sid);
        const base = {
            v: 1, through: sids.at(-1), count: k, sealedDigest: sealedDigest(sids), integrity: meta.integrity ?? null, chat: chatId() ?? null,
            state: structuredClone(at), carried: packProblems(head.problems.filter(problem => problem.index <= through), i => rawSidAt(arr, i)),
            proofs, anchors: { chain: chainHash(arr, edge), bare: bareHash(arr, edge), spine: spineBefore(arr, edge) },
            guarded: old?.guarded === true || carriers.slice(0, k).some(i => hasMeta(readRecord(arr[i]))),
            window: sealing.window, step: sealing.step, at: new Date().toISOString(),
        };
        const before = sealSnapshot(reads, edge);
        const window = carriers.slice(k);
        // Staged in place (a detached copy would not be the chat replay asks about), then read again from the base.
        const changes = [];
        try {
            if (!isObject(meta.storySuite)) set(changes, meta, 'storySuite', {});
            set(changes, meta.storySuite, 'base', base);
            set(changes, meta.storySuite, 'sealed', { through: base.through, count: k, window: sealing.window, at: base.at });
            for (const i of carriers.slice(0, k)) {
                const message = arr[i];
                if (!isSealed(readRecord(message))) set(changes, message.extra, KEY, sealRecord(readRecord(message)));
                for (const info of Array.isArray(message.swipe_info) ? message.swipe_info : []) {
                    const copy = info?.extra?.[KEY];
                    if (info.extra !== message.extra && isObject(copy) && copy.v === 2) set(changes, info.extra, KEY, sealRecord(copy));
                }
            }
            s.cache = null;
            s.history = null;
            forgetMemos();
            // One replay of the window from the base, past its checkpoints: the head it ends on must be the live head, and a checkpoint that does not
            // hold the state in front of it goes (made before a delete; the chain passes it over), the others' covers start at the base.
            const states = new Map();
            const full = replay(arr, window.at(-1), { whole: true, onRecord: (i, state) => states.set(i, state) });
            const stale = new Set(window.filter((i, n) => readRecord(arr[i])?.checkpoint
                && hashJson(n ? states.get(window[n - 1]) ?? null : historyOf(arr).state) !== hashJson(readRecord(arr[i]).checkpoint)));
            for (const i of window) recover(arr, i, changes, stale);
            s.cache = null;
            forgetMemos();
            const problemsOf = list => hashJson(list.map(({ message, ...rest }) => { void message; return rest; }));
            const why = (full.from !== edge || hashJson(full.state) !== before.head ? 'head (from the base)' : '')
                || (problemsOf(full.problems) !== problemsOf(head.problems) ? 'problems (from the base)' : '') || sealDiff(before, sealSnapshot(reads, edge), edge);
            if (why) {
                undo(changes);
                refused.add(chat);
                return { ok: false, why, refused: true };
            }
        } catch (error) {
            undo(changes);
            refused.add(chat);
            return { ok: false, why: `threw: ${error?.message ?? error}`, refused: true };
        }
        saver.touch();
        return { ok: true, sealed: k, through: base.through, from: edge };
    }

    return { seal };
}
