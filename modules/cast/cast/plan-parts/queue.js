// Story Director v2, part **cast**: caching and awaiting in-flight cast planner calls by key.

/**
 * The plans being asked for or already answered, by key. A plan is asked for after a reply (when the model's connection is free) and
 * used before the next one; a swipe, a Re-read or a second look at the same key finds the same answer, so who the cast brings does not
 * change with a rewrite of the scene. In memory only (a reload asks again). `size`: how many are kept.
 */
export function createPlans({ size = 24, timer = { setTimeout: (...args) => setTimeout(...args), clearTimeout: id => clearTimeout(id) } } = {}) {
    const held = new Map();
    const trim = () => { while (held.size > size) held.delete(held.keys().next().value); };
    return {
        /** Starts `run()` for `key` unless it is there already. Returns the entry `{ status: 'pending' | 'done' | 'failed', result, promise }`. */
        start(key, run) {
            if (held.has(key)) return held.get(key);
            const entry = { status: 'pending', result: null, promise: null };
            entry.promise = Promise.resolve().then(run).then(result => { entry.status = 'done'; entry.result = result; }, () => { entry.status = 'failed'; });
            held.set(key, entry);
            trim();
            return entry;
        },
        peek: key => held.get(key) ?? null,
        /** The entry for `key` once it has settled, or as it is after `ms` (still 'pending'). Null when there is none. */
        async settled(key, ms) {
            const entry = held.get(key);
            if (!entry) return null;
            if (entry.status !== 'pending' || !(ms > 0)) return entry;
            let timeout = null;
            await Promise.race([entry.promise, new Promise(resolve => { timeout = timer.setTimeout(resolve, ms); })]);
            timer.clearTimeout(timeout);
            return entry;
        },
        /** Every plan in flight has settled (for tests). */
        async idle() { await Promise.all([...held.values()].map(entry => entry.promise)); },
        clear: () => held.clear(),
        get size() { return held.size; },
    };
}
