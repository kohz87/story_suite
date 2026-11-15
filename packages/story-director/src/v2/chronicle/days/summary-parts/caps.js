// Story Director v2, chronicle part: older days kept short and the caps on how many days are kept. Pure.

import { bucketDay, trimCats } from '../../backlog.js';

/** An older day kept short: its date, its line, how many things it held and a compact list of them by kind (`cats`, at most about 1 KB: the Journal's search still reaches it). */
export function briefOf(digest) {
    const cats = trimCats(bucketDay(digest));
    return { day: digest.day, date: digest.date, line: digest.line, brief: true, count: digest.count, made: digest.made, ...(Object.keys(cats).length ? { cats } : {}) };
}

/**
 * The caps on `days` (a `{ [day]: Digest }` map): the newest `full` days stay whole, older ones are
 * kept short, and beyond `keep` the oldest go. → `{ [day]: Digest | null }`: what changes (null: drop).
 */
export function capDays(days, { full, keep }) {
    const order = Object.values(days).sort((a, b) => b.day - a.day);
    const changes = {};
    order.forEach((digest, index) => {
        if (index >= keep) changes[digest.day] = null;
        else if (index >= full && !digest.brief) changes[digest.day] = briefOf(digest);
    });
    return changes;
}
