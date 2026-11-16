// QA: the seeded "edit then Re-read" fuzz shard (see helpers/reread-fuzz-run.js for what every run checks): an
// earlier reply's text is edited to more or different lines and Re-read, then the chat must equal both the
// replay oracle's rebuild and the story told the edited way. The other state-fuzz shards do not edit before a
// Re-read; their seeds run as before.
// QA_REREAD_SEEDS=1-100 (or 7, or 3,9,12) and QA_REREAD_STEPS=n run a longer hunt locally; CI runs the fixed list.
import test from 'node:test';
import { fuzzReread } from './helpers/reread-fuzz-run.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const STEPS = Number(process.env.QA_REREAD_STEPS) || 40;

/** The seeds of a QA_REREAD_SEEDS list: `a-b` ranges and single numbers, comma-separated. */
function seedList(text) {
    return text.split(',').flatMap(part => {
        const [from, to] = part.split('-').map(Number);
        return Number.isInteger(to) ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : [from];
    });
}

const RUNS = process.env.QA_REREAD_SEEDS ? seedList(process.env.QA_REREAD_SEEDS) : SEEDS;

for (const seed of RUNS) {
    test(`edit-then-Re-read fuzz seed ${seed}: replay equals rebuild, and every Re-read equals the story told the edited way`, async t => {
        const stats = await fuzzReread(t, seed, STEPS);
        if (process.env.QA_FUZZ_STATS) console.log(JSON.stringify({ seed, ...stats }));
    });
}
