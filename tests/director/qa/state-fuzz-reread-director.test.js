// QA: the seeded "edit then Re-read" fuzz with Story Director on the host (Story Block's shard, state-fuzz-reread.test.js,
// has none). Same run and same checks (see story-block's helpers/reread-fuzz-run.js), with Director's own change lines
// drawn by the edits and the told-again compare on Director's readers. Counted, not failed: a later reply that keeps its
// record until it is Re-read (an orphan trip delay after the edit removed its trip), refused Re-reads and stacks
// picked by ID. Chronicle readers are left out of the compare (helpers/reread-host.js says why).
// QA_REREAD_SEEDS=1-100 (or 7, or 3,9,12) and QA_REREAD_STEPS=n run a longer hunt locally; CI runs the fixed list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fuzzReread } from '../../../packages/story-block/tests/v2/qa/helpers/reread-fuzz-run.js';
import { makeDirectorHost, directorLines, DIRECTOR_READERS, LEFT_OUT, TOLERATE, COUNTED } from './helpers/reread-host.js';

import { seedList } from '../../../packages/story-block/tests/v2/qa/helpers/seed-list.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
// The most reply-checks one seed may let the oracle tolerate (D-1): a drift that spreads cannot pass quietly.
const TOLERATED_CAP = 80;
const STEPS = Number(process.env.QA_REREAD_STEPS) || 40;

const RUNS = process.env.QA_REREAD_SEEDS ? seedList(process.env.QA_REREAD_SEEDS) : SEEDS;

for (const seed of RUNS) {
    test(`Story Director edit-then-Re-read fuzz seed ${seed}: no key clash, and every Re-read equals the story told the edited way`, async t => {
        const stats = await fuzzReread(t, seed, STEPS, { makeHost: makeDirectorHost, extraLines: directorLines, readers: DIRECTOR_READERS, leave: LEFT_OUT, tolerate: TOLERATE, counted: COUNTED });
        assert.ok(stats.tolerated <= TOLERATED_CAP, `seed ${seed}: the oracle tolerated ${stats.tolerated} reply-checks (cap ${TOLERATED_CAP}): the D-1 drift spreads`);
        if (process.env.QA_FUZZ_STATS) console.log(JSON.stringify({ seed, ...stats }));
    });
}
