// Recording one reply's know lines over the stored list.
import { KNOWS_MAX } from './shared-limits.js';
import { KNOW_HOW, KNOW_RULE } from './shared-marks.js';
import { replyKeyOk, sameFact } from './shared-clean.js';
import { readHow } from './how.js';
import { knowOf, listOf } from './read.js';

/**
 * Records one reply's `~ know` lines (`lines`: [{ about, fact, how, secret?, day? }]). The reply's earlier entries are replaced
 * (a Re-read), and so is any older entry with the same about and fact (a second source for it refreshes it, it does not repeat it).
 * The list keeps the newest KNOWS_MAX. → { text, problem }: `text` is the whole new leaf, or null with a `problem` when a line is
 * bad (the whole reply's command is then refused, nothing is written). An empty `lines` clears the reply's entries.
 */
export function addKnow(prior, reply, lines, { tolerant = false } = {}) {
    if (!replyKeyOk(reply) || !Array.isArray(lines)) return { text: null, problem: 'know needs a reply key and a list of lines' };
    const written = [];
    for (const line of lines) {
        // The rule mark is stored only on an entry whose written how: was not already exactly saw/heard (old bytes stay old bytes).
        const widened = tolerant && !KNOW_HOW.includes(line?.how);
        const entry = knowOf({ ...line, how: widened ? readHow(line?.how) : line?.how, r: reply, rule: widened || line?.rule === KNOW_RULE ? KNOW_RULE : 0 });
        if (!entry) return { text: null, problem: 'know needs about, fact and how (saw or heard)' };
        written.push(entry);
    }
    const kept = listOf(prior).filter(old => old.r !== reply && !written.some(entry => sameFact(entry, old)));
    return { text: JSON.stringify([...kept, ...written].slice(-KNOWS_MAX)), problem: null };
}
