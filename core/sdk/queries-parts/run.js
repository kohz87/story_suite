// Runs a registered query on a state with its tools: the answer is a plain copy (the packs' own frozen records excepted).

import { isDeepFrozen } from '../../ops/freeze.js';

// The queries whose answer is the packs' own records, frozen all the way down (packs/content-parts/records.js contentOf): that answer
// is handed out as it is, not copied. It was copied on every ask (thousands of times a reply, the whole world's places and events each
// time: LIVEPERF finding 1). Nothing can change a pack through it; a reader that wants to edit a record copies it first.
const SHARED_ANSWERS = new Set(['packs.content']);

/**
 * Runs a registered query on `state`; the answer is a plain copy, except a `packs.content` answer that is frozen all the way
 * down (the packs' own records), which is handed out as it is. Throws for an unknown query.
 * A query is called (state, args, tools) with tools.query(name, args) over the same state,
 * tools.receipts() → [{ index, receipt }], the stored receipts in chat order (`receipts` option),
 * tools.pendingProofs() → [{ proof }], a Re-read's planned proof (`pendingProofs` option, story.evidence), and
 * tools.reply ({ index, sid } or null, the `reply` option): the reply the state is the head of, as a
 * command's ctx.reply (commands.js).
 */
export function runQuery(registry, state, name, args, { receipts = () => [], reply = null, pendingProofs = null } = {}) {
    const query = registry.query(name);
    if (!query) throw new Error(`Story Suite: no module answers the query "${name}".`);
    const tools = Object.freeze({
        reply,
        hasQuery: other => Boolean(registry.query(other)),
        query: (other, otherArgs) => runQuery(registry, state, other, otherArgs, { receipts, reply, pendingProofs }),
        receipts: () => receipts() ?? [],
        // The proof a Re-read has planned but not stored (evidence.js), for story.evidence; none otherwise.
        ...(typeof pendingProofs === 'function' ? { pendingProofs } : {}),
    });
    const answer = query(state, args === undefined ? undefined : structuredClone(args), tools);
    // A query that has to read outside the state (the checkpoint reference scan) may answer a promise. Keep it a
    // promise so its caller can await it; every ordinary query still answers its copied value in the same tick.
    const out = value => (value === undefined ? undefined : SHARED_ANSWERS.has(name) && isDeepFrozen(value) ? value : structuredClone(value));
    if (answer !== null && typeof answer === 'object' && typeof answer.then === 'function') return Promise.resolve(answer).then(out);
    return out(answer);
}

/**
 * The mounts' query (src/v2/view/mounts/common.js): `(name, args, state)` → runQuery over that
 * state, so a card asks against its own reply's state and the registry's queries still get
 * (state, args, tools). A query that throws is the mount's to report (resolveData gives null).
 */
export const mountQuery = (registry, receipts = () => []) => (name, args, state) => runQuery(registry, state, name, args, { receipts });
