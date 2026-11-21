// Story Suite v2: the incremental prefix memo. A reply only appends a carrier, so the state after every older
// carrier stays valid. This keeps those states by the exact prefix each was replayed over, in a bounded LRU, and
// steps one new unguarded record from the previous state instead of replaying a checkpoint window again. A head replay's own
// states are kept too (`seed`), so a Re-read or a reconcile right after a rebuild starts from the state before its reply.

import { KEY, isCarrier, lastCarrier, readRecord } from '../persist.js';
import { hashJson } from '../replay.js';
import { deepFreeze } from './constants.js';
import { hasMeta } from './digest.js';

/** The most states one chat keeps in the prefix memo. An evicted state is simply replayed again. */
export const PREFIX_MEMO_MAX = 512;

const textOf = (read, fallback = '?') => {
    try { return String(read()); } catch { return fallback; }
};

export function createPrefixMemo(s, deps) {
    const { anchored = () => [0, '', true], chain, chatId, markNow, marked, replay, replayEnv, replayRecord, spineStep } = deps;
    const cache = s.prefixes instanceof Map ? s.prefixes : (s.prefixes = new Map());
    const checkpoints = new WeakMap();
    // The earliest replan point (s.replanFrom's kind) the replay of each kept state found. A hit or a step skips that replay, so it lowers
    // s.replanFrom again from here; without it a witness built on a shared base would keep no replan point at all.
    const replans = new WeakMap();
    const lower = state => {
        const at = state !== null && typeof state === 'object' ? replans.get(state) : undefined;
        if (at !== undefined && at < s.replanFrom) s.replanFrom = at;
    };
    function replayKept(arr, index) {
        const before = s.replanFrom;
        s.replanFrom = Infinity;
        let found = Infinity;
        let state;
        try { state = deepFreeze(replay(arr, index).state); } finally { found = s.replanFrom; s.replanFrom = Math.min(before, found); }
        if (state !== null && typeof state === 'object') replans.set(state, found);
        return state;
    }
    const bump = name => {
        if (!s.counts) return;
        s.counts[name] = (Number.isFinite(s.counts[name]) ? s.counts[name] : 0) + 1;
    };

    // The spine covers replay inputs, but intentionally omits later checkpoints and their trust fields (`owned`, the proof owners a guard may ask, included). Chain those
    // separately for this memo: changing one can change where replay starts even when the ordinary spine is unchanged.
    // Both links are cached per immutable record, so an unchanged pass costs one lookup per carrier/checkpoint.
    function spineRun(arr) {
        const out = new Array(arr.length);
        // (a sealed chat's run starts after its sealed replies, from the base's anchor; they get no entry: no state is kept for them)
        let [i0, hash, first] = anchored(arr, arr.length, 'spine');
        let checkpointHash = i0 ? hash : '';
        for (let i = i0; i < arr.length; i++) {
            if (!isCarrier(arr[i])) continue;
            const record = readRecord(arr[i]);
            if (!record) continue;
            hash = spineStep(hash, record, arr[i], first);
            if (record.checkpoint) {
                const hit = checkpoints.get(record);
                if (hit && hit.prev === checkpointHash) checkpointHash = hit.out;
                else {
                    const trust = {};
                    for (const field of ['prefix', 'covers', 'coverHash', 'guardEnv', 'owned']) {
                        if (record[field] !== undefined) trust[field] = record[field];
                    }
                    const out = hashJson({ p: checkpointHash, checkpoint: record.checkpoint, trust });
                    checkpoints.set(record, { prev: checkpointHash, out });
                    checkpointHash = out;
                }
            }
            first = false;
            out[i] = JSON.stringify([hash, checkpointHash]);
        }
        return out;
    }

    // The exact key: the spine hash through the carrier, then the replay environment (Features), the guard mark
    // when guards have been seen, the reply mark, and the chat id. Each part is a string, in this fixed order.
    function keyOf(spine) {
        return JSON.stringify([
            String(spine),
            textOf(replayEnv),
            s.guardSeen ? textOf(markNow) : '',
            textOf(marked),
            textOf(chatId),
        ]);
    }

    function touch(key) {
        const state = cache.get(key);
        cache.delete(key);
        cache.set(key, state);
        return state;
    }

    function remember(key, state) {
        if (cache.has(key)) cache.delete(key);
        cache.set(key, state);
        while (cache.size > PREFIX_MEMO_MAX) cache.delete(cache.keys().next().value);
    }

    // The state of the nearest earlier carrier with a record. Carriers without records do not change the state,
    // so they are passed over; a record that is not in the memo cannot be passed over, because its ops matter.
    function previous(arr, index, spines) {
        for (let i = index - 1; i >= 0; i--) {
            if (!isCarrier(arr[i])) continue;
            const record = readRecord(arr[i]);
            if (!record || spines[i] === undefined) continue;
            const key = keyOf(spines[i]);
            return cache.has(key) ? { key, state: cache.get(key) } : null;
        }
        return null;
    }

    /**
     * The state after carrier `index`. A hit is returned as stored (deep-frozen). A miss steps the one new
     * record from the previous carrier's memo when the record has no checkpoint and no guarded block occurs
     * through it; otherwise it replays through the store's normal checkpoint chain.
     *
     * `spines` is optional: pass the result of one spineRun(arr) to reuse it across a synchronous witness scope.
     */
    function stateAfterPrefix(arr, index, spines = null) {
        if (!Array.isArray(arr)) throw new TypeError('stateAfterPrefix needs the chat array.');
        if (!Number.isInteger(index) || index < 0 || index >= arr.length) {
            throw new RangeError(`There is no message ${index} in this chat.`);
        }
        const run = spines ?? spineRun(arr);
        takeSeeds(arr, run);
        const record = isCarrier(arr[index]) ? readRecord(arr[index]) : null;
        if (!record) {
            const before = lastCarrier(arr, index);
            return before < 0 ? null : stateAfterPrefix(arr, before, run);
        }

        if (s.applying || s.staged) {
            bump('prefixReplays');
            return replay(arr, index).state;
        }

        const spine = run[index];
        if (spine === undefined) {
            bump('prefixReplays');
            return replay(arr, index).state;
        }
        const key = keyOf(spine);
        if (cache.has(key)) {
            bump('prefixHits');
            const kept = touch(key);
            lower(kept);
            return kept;
        }

        const fast = !record.checkpoint && !hasMeta(record) && !chain(arr, index).history;
        if (fast) {
            const prior = previous(arr, index, run);
            if (prior && prior.state !== null && prior.state !== undefined) {
                const state = deepFreeze(replayRecord(prior.state, record, index, [], null, arr[index]));
                touch(prior.key);
                if (state !== null && typeof state === 'object') {
                    const at = replans.get(prior.state);
                    if (at !== undefined) replans.set(state, at);
                }
                lower(state);
                bump('prefixSteps');
                bump('recordsRead');
                remember(key, state);
                return state;
            }
        }

        bump('prefixReplays');
        const state = replayKept(arr, index);
        remember(key, state);
        return state;
    }

    // The head replay's own states (memo.js current), kept until the next prefix read takes them in (seed, below): { arr, epoch, from, env,
    // entries: [{ index, state, replan, refs }] }. Taking them in needs the spine of the whole chat, which only a prefix read works out.
    let pending = null;
    const envKey = () => JSON.stringify([textOf(replayEnv), s.guardSeen ? textOf(markNow) : '', textOf(marked), textOf(chatId)]);
    const refsOf = message => [message, message?.extra, message?.extra?.[KEY], message?.swipe_id, message?.mes];

    /**
     * The head replay's own states: the state after each carrier it passed (from the checkpoint it replayed from), with the replan point
     * found so far. A carrier at or after that checkpoint starts from it too (chain's checkpoint only moves on along the chat), so each is
     * exactly what replayKept would give for its prefix. Kept, so a Re-read or a reconcile right after a rebuild starts from the state
     * before its reply instead of replaying from the checkpoint again (LIVEPERF findings 3 and 4). Only the replayed window is looked at here.
     */
    function seed(arr, entries, from) {
        pending = null;
        if (!entries.length || s.applying || s.staged || !Number.isInteger(from) || from < 0) return;
        pending = { arr, epoch: s.epoch, from, env: envKey(), entries: entries.map(entry => ({ ...entry, refs: refsOf(arr[entry.index]) })) };
    }

    // Takes the kept head-replay states in, under the spines of the chat as it is now, while nothing changed since: the same array, no
    // write or rebuild since (epoch), the same replay environment, the same checkpoint to start from, and each carrier the same message,
    // record, swipe and text (the first that is not stops it: the ones after it were replayed over it).
    function takeSeeds(arr, run) {
        const seeds = pending;
        if (!seeds || s.applying || s.staged) return;
        pending = null;
        if (seeds.arr !== arr || seeds.epoch !== s.epoch || seeds.env !== envKey()) return;
        if (chain(arr, seeds.entries.at(-1).index).from !== seeds.from) return;
        for (const { index, state, replan, refs } of seeds.entries) {
            const now = refsOf(arr[index]);
            if (run[index] === undefined || state === null || typeof state !== 'object' || refs.some((ref, at) => ref !== now[at])) return;
            deepFreeze(state);
            replans.set(state, replan);
            remember(keyOf(run[index]), state);
        }
    }

    return { spineRun, stateAfterPrefix, seed };
}
