// The helpers' run log that `assist.status` reports.

const LOG_LIMIT = 30;

/**
 * The helpers' run log, newest last: { add(entry) → entry, list(), last(helper) }. Each entry gets a
 * `seq` (1, 2, …) so the status can say which run came last without a clock.
 */
export function createRunLog(limit = LOG_LIMIT) {
    const entries = [];
    let seq = 0;
    return {
        add(entry) {
            seq += 1;
            const item = Object.freeze({ seq, ...entry });
            entries.push(item);
            if (entries.length > limit) entries.splice(0, entries.length - limit);
            return item;
        },
        list: () => entries.map(entry => ({ ...entry })),
        last(helper) {
            const found = entries.findLast(entry => entry.helper === helper);
            return found ? { ...found } : null;
        },
    };
}
